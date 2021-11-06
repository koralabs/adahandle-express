import * as express from "express";

import { MAX_SESSION_LENGTH } from '../../../helpers/constants';
import { checkPayments } from '../../../helpers/graphql';
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
export const updateSessionsHandler = async (req: express.Request, res: express.Response) => {
  const activeSessions: ActiveSession[] = await ActiveSessions.getActiveSessions();
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
  const sessionPaymentStatuses = await checkPayments(activeSessions.map(s => s.wallet.address));

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
        removableActiveVal.push(entry);

        // Refund if it has a balance.
        if (matchingPayment && matchingPayment.amount !== 0) {
          refundableVal.push(new RefundableSession({
            wallet: entry.wallet,
            amount: matchingPayment.amount,
            handle: entry.handle,
          }));
        }
        return;
      }

      // Refund invalid payments.
      if (
        matchingPayment.amount !== 0 &&
        matchingPayment.amount !== toLovelace(entry.cost)
      ) {
        removableActiveVal.push(entry);
        refundableVal.push(new RefundableSession({
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
          refundableVal.push(new RefundableSession({
            wallet: entry.wallet,
            amount: matchingPayment.amount,
            handle: entry.handle
          }));
        } else {
          paidVal.push(entry);
        }

        removableActiveVal.push(entry);
        return;
      }
    }
  );

  // TODO: add all to a transaction
  const promises = [
    RefundableSessions.addRefundableSessions(refundableVal),
    PaidSessions.addPaidSessions(paidVal),
    ActiveSessions.removeActiveSessions(removableActiveVal)
    // PendingSessions.removePendingSessions(expiredPending),
  ]

  try {
    // Update session states.
    const updates = await Promise.all(promises);
    return res.status(200).json({
      error: false,
      jobs: updates
    })
  } catch (e) {
    return res.status(500).json({
      error: true,
      message: e
    })
  }
}
