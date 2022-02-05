import * as express from "express";

import { MAX_SESSION_LENGTH_CLI, MAX_SESSION_LENGTH_SPO, SPO_HANDLE_ADA_REFUND_FEE } from '../../../helpers/constants';
import { checkPayments } from '../../../helpers/graphql';
import { LogCategory, Logger } from "../../../helpers/Logger";
import { toLovelace } from "../../../helpers/utils";
import { ActiveSession, Status, WorkflowStatus } from '../../../models/ActiveSession';
import { ActiveSessions } from '../../../models/firestore/collections/ActiveSession';
import { StateData } from "../../../models/firestore/collections/StateData";
import { StakePools } from "../../../models/firestore/collections/StakePools";
import { CreatedBySystem } from '../../../helpers/constants';

/**
 * Filters out old sessions from the /activeSessions document.
 */
export const updateSessions = async (req: express.Request, res: express.Response) => {
  // if process is running, bail out of cron job

  const startTime = Date.now();
  const getLogMessage = (startTime: number, recordCount: number) => ({ message: `updateSessionsHandler processed ${recordCount} records in ${Date.now() - startTime}ms`, event: 'updateSessionsHandler.run', count: recordCount, milliseconds: Date.now() - startTime, category: LogCategory.METRIC });
  const stateData = await StateData.getStateData();
  try {
    // TODO: Should we also be checking for duplicate handles here?
    const activeSessions: ActiveSession[] = await ActiveSessions.getPendingActiveSessions();
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
      return res.status(200).json({
        error: false,
        message: 'No active sessions!'
      });
    }

    const removableActiveVal: ActiveSession[] = [];
    const paidVal: ActiveSession[] = [];
    const walletAddresses = dedupeActiveSessions.map(s => s.paymentAddress)

    const startCheckPaymentsTime = Date.now();
    const sessionPaymentStatuses = await checkPayments(walletAddresses);
    Logger.log({ message: `check payment finished in ${Date.now() - startCheckPaymentsTime}ms and processed ${walletAddresses.length} addresses`, event: 'updateSessionsHandler.checkPayments', count: walletAddresses.length, milliseconds: Date.now() - startTime, category: LogCategory.METRIC });

    dedupeActiveSessions.forEach(
      async (entry, index) => {
        const sessionAge = Date.now() - entry?.start;
        const maxSessionLength = entry.createdBySystem == CreatedBySystem.CLI ? MAX_SESSION_LENGTH_CLI : (entry.createdBySystem == CreatedBySystem.SPO ? MAX_SESSION_LENGTH_SPO : stateData.accessWindowTimeoutMinutes)
        const matchingPayment = sessionPaymentStatuses[index];

        if (!matchingPayment) {
          return;
        }

        /**
         * Remove if expired and not paid
         * Refund if not expired but invalid payment
         * Refund if expired and paid
         * Refund if paid sessions already has handle
         * Refund SPO and charge fee
         * Move to paid if accurate payment and not expired
         * Leave alone if not expired and no payment
         */

        // Handle expired.
        if (sessionAge >= maxSessionLength) {
          if (matchingPayment && matchingPayment.amount !== 0) {
            ActiveSessions.updateSessions([new ActiveSession({
              ...entry,
              emailAddress: '',
              refundAmount: matchingPayment.amount,
              returnAddress: matchingPayment.returnAddress,
              status: Status.REFUNDABLE,
              workflowStatus: WorkflowStatus.PENDING
            })]);
            return;
          }

          // If there is no amount, it's possible that a payment was made after the session expired.
          ActiveSessions.updateSessions([new ActiveSession({
            ...entry,
            emailAddress: '',
            refundAmount: matchingPayment.amount,
            returnAddress: matchingPayment.returnAddress,
            status: Status.REFUNDABLE,
            workflowStatus: WorkflowStatus.PENDING
          })]);
          return;
        }

        // Refund invalid payments.
        if (matchingPayment.amount !== 0) {

          // If no return address, refund.
          if (!matchingPayment.returnAddress) {
            ActiveSessions.updateSessions([new ActiveSession({
              ...entry,
              emailAddress: '',
              refundAmount: matchingPayment.amount,
              returnAddress: matchingPayment.returnAddress,
              status: Status.REFUNDABLE,
              workflowStatus: WorkflowStatus.PENDING
            })]);
            // This should never happen:
            Logger.log({ category: LogCategory.NOTIFY, message: `Refund has no returnAddress! PaymentAddress is ${entry.paymentAddress}`, event: 'updateSessionsHandler.run' });
            return;
          }

          if (matchingPayment.amount !== entry.cost) {
            ActiveSessions.updateSessions([new ActiveSession({
              ...entry,
              emailAddress: '',
              refundAmount: entry.createdBySystem === CreatedBySystem.SPO ? Math.max(0, matchingPayment.amount - toLovelace(SPO_HANDLE_ADA_REFUND_FEE)) : matchingPayment.amount,
              returnAddress: matchingPayment.returnAddress,
              status: Status.REFUNDABLE,
              workflowStatus: WorkflowStatus.PENDING
            })]);
            return;
          }

          // Move valid paid sessions to minting queue.
          if (matchingPayment.amount === entry.cost) {

            // If already has a handle, refund.
            if (paidVal.some(e => e.handle === entry.handle)) {
              ActiveSessions.updateSessions([new ActiveSession({
                ...entry,
                emailAddress: '',
                refundAmount: matchingPayment.amount,
                returnAddress: matchingPayment.returnAddress,
                status: Status.REFUNDABLE,
                workflowStatus: WorkflowStatus.PENDING
              })]);
              return;
            }

            // verify SPO can purchase the ticker
            if (entry.createdBySystem === CreatedBySystem.SPO) {
              const returnAddressOwnsStakePool = await StakePools.verifyReturnAddressOwnsStakePool(matchingPayment.returnAddress, entry.handle);
              if (!returnAddressOwnsStakePool) {
                // if not, refund cost plus fee
                ActiveSessions.updateSessions([new ActiveSession({
                  ...entry,
                  emailAddress: '',
                  refundAmount: Math.max(0, matchingPayment.amount - toLovelace(SPO_HANDLE_ADA_REFUND_FEE)),
                  returnAddress: matchingPayment.returnAddress,
                  status: Status.REFUNDABLE,
                  workflowStatus: WorkflowStatus.PENDING
                })]);
                return;
              }
            }

            paidVal.push(entry);
            ActiveSessions.updateSessions([new ActiveSession({
              ...entry,
              emailAddress: '',
              returnAddress: matchingPayment.returnAddress,
              status: Status.PAID,
              workflowStatus: WorkflowStatus.PENDING
            })]);
          }
        }
      }
    );

    Logger.log(getLogMessage(startTime, activeSessions.length));

    res.status(200).json({
      error: false,
      jobs: {
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

export const updateSessionsHandler = async (req: express.Request, res: express.Response) => {
  if (!await StateData.checkAndLockCron('updateActiveSessionsLock')) {
    return res.status(200).json({
      error: false,
      message: 'Update Sessions cron is locked. Try again later.'
    });
  }
  await updateSessions(req, res);
  await StateData.unlockCron('updateActiveSessionsLock');
}