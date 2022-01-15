import * as express from "express";

import { MAX_SESSION_LENGTH_UI, MAX_SESSION_LENGTH_CLI, MAX_SESSION_LENGTH_SPO } from '../../../helpers/constants';
import { checkPayments } from '../../../helpers/graphql';
import { LogCategory, Logger } from "../../../helpers/Logger";
import { toLovelace } from "../../../helpers/utils";
import { ActiveSession } from '../../../models/ActiveSession';
import { ActiveSessions } from '../../../models/firestore/collections/ActiveSession';
import { PaidSessions } from '../../../models/firestore/collections/PaidSessions';
import { RefundableSessions } from '../../../models/firestore/collections/RefundableSessions';
import { CronJobLockName, StateData } from "../../../models/firestore/collections/StateData";
import { PaidSession } from "../../../models/PaidSession";
import { RefundableSession } from '../../../models/RefundableSession';
import { CreatedBySystem}  from '../../../helpers/constants';

/**
 * Filters out old sessions from the /activeSessions document.
 */
export const updateSessionsHandler = async (req: express.Request, res: express.Response) => {
  // if process is running, bail out of cron job
  const stateData = await StateData.getStateData();
  if (stateData[CronJobLockName.UPDATE_ACTIVE_SESSIONS_LOCK]) {
    Logger.log({ message: `Cron job ${CronJobLockName.UPDATE_ACTIVE_SESSIONS_LOCK} is locked`, event: 'updateSessionsHandler.locked', category: LogCategory.NOTIFY });
    return res.status(200).json({
      error: false,
      message: 'Update Sessions cron is locked. Try again later.'
    });
  }

  await StateData.lockCron(CronJobLockName.UPDATE_ACTIVE_SESSIONS_LOCK);

  const startTime = Date.now();
  const getLogMessage = (startTime: number, recordCount: number) => ({ message: `updateSessionsHandler processed ${recordCount} records in ${Date.now() - startTime}ms`, event: 'updateSessionsHandler.run', count: recordCount, milliseconds: Date.now() - startTime, category: LogCategory.METRIC });

  try {
    // TODO: Should we also be checking for duplicate handles here?
    const activeSessions: ActiveSession[] = await ActiveSessions.getActiveSessions();
    const dedupeActiveSessionsMap = activeSessions.reduce<Map<string, ActiveSession>>((acc, session) => {
      if (acc.has(session.paymentAddress)) {
        Logger.log({ message: `Duplicate session found for ${session.paymentAddress}`, event: 'updateSessionsHandler.duplicate', category: LogCategory.NOTIFY });
        return acc;
      }

      acc.set(session.paymentAddress, session);
      return acc;
    }, new Map());
    
    const dedupeActiveSessions: ActiveSession[] = [...dedupeActiveSessionsMap.values()];
    if (dedupeActiveSessions.length == 0) {
      await StateData.unlockCron(CronJobLockName.UPDATE_ACTIVE_SESSIONS_LOCK);
      return res.status(200).json({
        error: false,
        message: 'No active sessions!'
      });
    }

    const removableActiveVal: ActiveSession[] = [];
    const refundableVal: RefundableSession[] = [];
    const paidVal: ActiveSession[] = [];
    const walletAddresses = dedupeActiveSessions.map(s => s.paymentAddress)

    const startCheckPaymentsTime = Date.now();
    const sessionPaymentStatuses = await checkPayments(walletAddresses);
    Logger.log({ message: `check payment finished in ${Date.now() - startCheckPaymentsTime}ms and processed ${walletAddresses.length} addresses`, event: 'updateSessionsHandler.checkPayments', count: walletAddresses.length, milliseconds: Date.now() - startTime, category: LogCategory.METRIC });

    dedupeActiveSessions.forEach(
      (entry, index) => {
        const sessionAge = Date.now() - entry?.start;
        const maxSessionLength = entry.createdBySystem == CreatedBySystem.CLI ? MAX_SESSION_LENGTH_CLI : (entry.createdBySystem == CreatedBySystem.SPO ? MAX_SESSION_LENGTH_SPO : MAX_SESSION_LENGTH_UI)
        const matchingPayment = sessionPaymentStatuses[index];

        if (!matchingPayment) {
          return;
        }

        /**
         * Remove if expired and not paid
         * Refund if not expired but invalid payment
         * Refund if expired and paid
         * Refund if paid sessions already has handle
         * Move to paid if accurate payment and not expired
         * Leave alone if not expired and no payment
         */

        // Handle expired.
        if (sessionAge >= maxSessionLength) {
          if (matchingPayment && matchingPayment.amount !== 0) {
            ActiveSessions.removeActiveSession(entry, RefundableSessions.addRefundableSession, new RefundableSession({
              paymentAddress: entry.paymentAddress,
              amount: matchingPayment.amount,
              handle: entry.handle,
              returnAddress: matchingPayment.returnAddress,
              createdBySystem: entry.createdBySystem
            }));

            return;
          }

          ActiveSessions.removeAndAddToDLQ([entry]);
          return;
        }

        // Refund invalid payments.
        if (matchingPayment.amount !== 0) {

          // If no return address, refund.
          if (!matchingPayment.returnAddress) {
            ActiveSessions.removeActiveSession(entry, RefundableSessions.addRefundableSession, new RefundableSession({
              paymentAddress: entry.paymentAddress,
              amount: matchingPayment.amount,
              handle: entry.handle,
              returnAddress: matchingPayment.returnAddress,
              createdBySystem: entry.createdBySystem
            }));
            // This should never happen:
            Logger.log({ category: LogCategory.NOTIFY, message: `Refund has no returnAddress! PaymentAddress is ${entry.paymentAddress}`, event: 'updateSessionsHandler.run' });
            return;
          }

          if (matchingPayment.amount !== toLovelace(entry.cost)) {
            ActiveSessions.removeActiveSession(entry, RefundableSessions.addRefundableSession, new RefundableSession({
              paymentAddress: entry.paymentAddress,
              amount: matchingPayment.amount,
              handle: entry.handle,
              returnAddress: matchingPayment.returnAddress,
              createdBySystem: entry.createdBySystem
            }));
            return;
          }

          // Move valid paid sessions to minting queue.
          if (matchingPayment.amount === toLovelace(entry.cost)) {

            // If already has a handle, refund.
            if (paidVal.some(e => e.handle === entry.handle)) {
              ActiveSessions.removeActiveSession(entry, RefundableSessions.addRefundableSession, new RefundableSession({
                paymentAddress: entry.paymentAddress,
                amount: matchingPayment.amount,
                handle: entry.handle,
                returnAddress: matchingPayment.returnAddress,
                createdBySystem: entry.createdBySystem
              }));
              return;
            }

            paidVal.push(entry);
            ActiveSessions.removeActiveSession(entry, PaidSessions.addPaidSession, new PaidSession({
              ...entry,
              returnAddress: matchingPayment.returnAddress,
              emailAddress: '', // email address intentionally scrubbed for privacy
              status: 'pending',
            }));
          }
        }
      }
    );

    Logger.log(getLogMessage(startTime, activeSessions.length));
    await StateData.unlockCron(CronJobLockName.UPDATE_ACTIVE_SESSIONS_LOCK);

    res.status(200).json({
      error: false,
      jobs: {
        refund: refundableVal.length,
        paid: paidVal.length,
        removed: removableActiveVal.length
      }
    });
  } catch (e) {
    Logger.log({ category: LogCategory.NOTIFY, message: `Active sessions queue has an exception and is locked: ${JSON.stringify(e)}`, event: 'updateSessionsHandler.run' })
    return res.status(500).json({
      error: true,
      message: e
    })
  }
}
