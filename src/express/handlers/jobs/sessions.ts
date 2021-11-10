import * as express from "express";

import { MAX_SESSION_LENGTH } from '../../../helpers/constants';
import { checkPayments, WalletSimplifiedBalance } from '../../../helpers/graphql';
import { toLovelace } from "../../../helpers/utils";
import { ActiveSession } from '../../../models/ActiveSession';
import { ActiveSessions } from '../../../models/firestore/collections/ActiveSession';
import { PaidSessions } from '../../../models/firestore/collections/PaidSessions';
import { RefundableSessions } from '../../../models/firestore/collections/RefundableSessions';
import { PaidSession } from "../../../models/PaidSession";
import { RefundableSession } from '../../../models/RefundableSession';

/**
 * Filters out old sessions from the /activeSessions document.
 */
export const updateSessionsHandler = async (req: express.Request, res: express.Response, checkPaymentsFunction: any = null) => {
  // if process is running, bail out of cron job

  const activeSessions: ActiveSession[] = await ActiveSessions.getActiveSessions();
  // remove duplicates

  if (!activeSessions) {
    return res.status(200).json({
      error: false,
      message: 'No active sessions!'
    });
  }

  // const expiredPending: PendingSession[] = [];
  const removableActiveVal: ActiveSession[] = [];
  const refundableVal: RefundableSession[] = [];
  const paidVal: ActiveSession[] = [];
  const walletAddresses = activeSessions.map(s => s.wallet.address)

  const startTime = Date.now();
  const sessionPaymentStatuses = checkPaymentsFunction ? checkPaymentsFunction(walletAddresses) : await checkPayments(walletAddresses);
  const endTime = Date.now();
  console.log(`Execution time: ${startTime - endTime} of checkPayments`);

  activeSessions.forEach(
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
        ActiveSessions.removeActiveSession(entry, (t) => {
          if (matchingPayment && matchingPayment.amount !== 0) {
            // Refund if it has a balance.
            RefundableSessions.addRefundableSession(new RefundableSession({
              wallet: entry.wallet,
              amount: matchingPayment.amount,
              handle: entry.handle,
            }), t);
          }
        });
        return;
      }

      // Refund invalid payments.
      if (
        matchingPayment.amount !== 0 &&
        matchingPayment.amount !== toLovelace(entry.cost)
      ) {
        ActiveSessions.removeActiveSession(entry, (t) => {
          RefundableSessions.addRefundableSession(new RefundableSession({
            wallet: entry.wallet,
            amount: matchingPayment.amount,
            handle: entry.handle
          }), t);
        });
        return;
      }

      // Move valid paid sessions to minting queue.
      if (matchingPayment.amount === toLovelace(entry.cost)) {

        // If already has a handle, refund.
        if (paidVal.some(e => e.handle === entry.handle)) {
          ActiveSessions.removeActiveSession(entry, (t) => {
            RefundableSessions.addRefundableSession(new RefundableSession({
              wallet: entry.wallet,
              amount: matchingPayment.amount,
              handle: entry.handle
            }), t);
          });
          return;
        }

        paidVal.push(entry);
        ActiveSessions.removeActiveSession(entry, (t) => {
          PaidSessions.addPaidSession(new PaidSession({
            ...entry,
          }), t);
        });
      }
    }
  );

  try {
    // Update session states.
    return res.status(200).json({
      error: false,
      jobs: {
        refund: refundableVal.length,
        paid: paidVal.length,
        removed: removableActiveVal.length
      }
    })
  } catch (e) {
    return res.status(500).json({
      error: true,
      message: e
    })
  }
}
