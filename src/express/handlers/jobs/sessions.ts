import * as express from "express";

import { MAX_SESSION_LENGTH } from '../../../helpers/constants';
import { checkPayments, WalletSimplifiedBalance } from '../../../helpers/graphql';
import { LogCategory, Logger } from "../../../helpers/Logger";
import { toLovelace } from "../../../helpers/utils";
import { ActiveSession } from '../../../models/ActiveSession';
import { ActiveSessions } from '../../../models/firestore/collections/ActiveSession';
import { PaidSessions } from '../../../models/firestore/collections/PaidSessions';
import { RefundableSessions } from '../../../models/firestore/collections/RefundableSessions';
import { CronJobLockName, StateData } from "../../../models/firestore/collections/StateData";
import { PaidSession } from "../../../models/PaidSession";
import { RefundableSession } from '../../../models/RefundableSession';

const CRON_JOB_LOCK_NAME = CronJobLockName.UPDATE_ACTIVE_SESSIONS_LOCK;

/**
 * Filters out old sessions from the /activeSessions document.
 */
export const updateSessionsHandler = async (req: express.Request, res: express.Response, checkPaymentsFunction: any = null) => {
  // if process is running, bail out of cron job
  const stateData = await StateData.getStateData();
  if (stateData[CRON_JOB_LOCK_NAME]) {
    Logger.log({ message: `Cron job ${CRON_JOB_LOCK_NAME} is locked`, event: 'updateSessionsHandler.locked', category: LogCategory.NOTIFY });
    return res.status(200).json({
      error: false,
      message: 'Cron is locked. Try again later.'
    });
  };

  await StateData.lockCron(CRON_JOB_LOCK_NAME);


  const activeSessions: ActiveSession[] = await ActiveSessions.getActiveSessions();
  const dedupeActiveSessionsMap = activeSessions.reduce<Map<string, ActiveSession>>((acc, session) => {
    if (acc.has(session.wallet.address)) {
      Logger.log({ message: `Duplicate session found for ${session.wallet.address}`, event: 'updateSessionsHandler.duplicate', category: LogCategory.NOTIFY });
      return acc;
    }

    acc.set(session.wallet.address, session);
    return acc;
  }, new Map());

  const dedupeActiveSessions: ActiveSession[] = [...dedupeActiveSessionsMap.values()];
  if (dedupeActiveSessions.length == 0) {
    return res.status(200).json({
      error: false,
      message: 'No active sessions!'
    });
  }

  const removableActiveVal: ActiveSession[] = [];
  const refundableVal: RefundableSession[] = [];
  const paidVal: ActiveSession[] = [];
  const walletAddresses = dedupeActiveSessions.map(s => s.wallet.address)

  const startTime = Date.now();
  const sessionPaymentStatuses = checkPaymentsFunction ? await checkPaymentsFunction(walletAddresses) : await checkPayments(walletAddresses);
  Logger.log({ message: `check payment finished in ${Date.now() - startTime}ms and processed ${walletAddresses.length} addresses`, event: 'updateSessionsHandler.checkPayments', category: LogCategory.METRIC });

  dedupeActiveSessions.forEach(
    (entry, index) => {
      const sessionAge = Date.now() - entry?.start;
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
      if (sessionAge >= MAX_SESSION_LENGTH) {
        if (matchingPayment && matchingPayment.amount !== 0) {
          ActiveSessions.removeActiveSession(entry, RefundableSessions.addRefundableSession, new RefundableSession({
            wallet: entry.wallet,
            amount: matchingPayment.amount,
            handle: entry.handle,
          }));

          return;
        }

        ActiveSessions.removeActiveSession(entry);
        return;
      }

      // Refund invalid payments.
      if (
        matchingPayment.amount !== 0 &&
        matchingPayment.amount !== toLovelace(entry.cost)
      ) {
        ActiveSessions.removeActiveSession(entry, RefundableSessions.addRefundableSession, new RefundableSession({
          wallet: entry.wallet,
          amount: matchingPayment.amount,
          handle: entry.handle
        }));
        return;
      }

      // Move valid paid sessions to minting queue.
      if (matchingPayment.amount === toLovelace(entry.cost)) {

        // If already has a handle, refund.
        if (paidVal.some(e => e.handle === entry.handle)) {
          ActiveSessions.removeActiveSession(entry, RefundableSessions.addRefundableSession, new RefundableSession({
            wallet: entry.wallet,
            amount: matchingPayment.amount,
            handle: entry.handle
          }));
          return;
        }

        paidVal.push(entry);
        ActiveSessions.removeActiveSession(entry, PaidSessions.addPaidSession, new PaidSession({
          ...entry,
        }));
      }
    }
  );

  Logger.log({ message: `Active Sessions Processed ${dedupeActiveSessions.length}`, event: 'updateSessionsHandler.activeSession.count', category: LogCategory.METRIC });

  try {
    await StateData.unlockCron(CRON_JOB_LOCK_NAME);

    res.status(200).json({
      error: false,
      jobs: {
        refund: refundableVal.length,
        paid: paidVal.length,
        removed: removableActiveVal.length
      }
    });
  } catch (e) {
    return res.status(500).json({
      error: true,
      message: e
    })
  }
}
