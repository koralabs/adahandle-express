import * as express from "express";

import { MAX_CHAIN_LOAD } from "../../../helpers/constants";
import { mintHandleAndSend } from "../../../helpers/wallet";
import { handleExists } from "../../../helpers/graphql";
import { getChainLoad } from '../../../helpers/cardano';
import { PaidSessions } from '../../../models/firestore/collections/PaidSessions';
import { MintedHandles } from '../../../models/firestore/collections/MintedHandles';
import { MintedHandle } from '../../../models/MintedHandle';
import { PaidSession } from '../../../models/PaidSession';
import { RefundableSessions } from "../../../models/firestore/collections/RefundableSessions";
import { RefundableSession } from "../../../models/RefundableSession";
import { toLovelace } from "../../../helpers/utils";

export const mintPaidSessionsHandler = async (req: express.Request, res: express.Response) => {
  const load = await getChainLoad();

  if (!load || load > MAX_CHAIN_LOAD) {
    return res.status(200).json({
      error: false,
      message: 'Chain load is too high.'
    });
  }

  const paidSessions: PaidSession[] = await PaidSessions.getPaidSessions();
  if (!paidSessions) {
    return res.status(200).json({
      error: false,
      message: 'No paid sessions!'
    });
  }

  // Ensure unique sessions!!!
  const uniquePaidSessions = paidSessions.filter((v, i, a) => a.findIndex(t => (t.handle === v.handle)) === i);
  const batch = uniquePaidSessions.slice(0, 10);

  const jobs = await Promise.all(
    batch.map(async session => {

      // Ensure no double mint.
      const { exists } = await handleExists(session.handle);
      const minted = await MintedHandles.getMintedHandles();

      if (exists || minted?.some(handle => handle.handleName === session.handle)) {
        console.warn(`Handle (${session.handle} already minted!. Moving to refund queue.`);
        try {
          await RefundableSessions.addRefundableSessions([
            new RefundableSession({
              wallet: session.wallet,
              amount: toLovelace(session.cost),
              handle: session.handle,
            })
          ]);
          await PaidSessions.removePaidSessions([session]);
        } catch (e) {
          console.log('Trying to record a refund from an attempted double mint, but failed.', session.wallet);
        }

        //await PendingSessions.removePendingSessions([new PendingSession(session.handle)]);

        return false;
      }

      // Mint the handle!
      try {
        console.info('Attempting to mint the handle!');
        const txId = await mintHandleAndSend(session);
        if (txId) {
          // Add minted handle to our internal database.
          await MintedHandles.addMintedHandle(new MintedHandle(session.handle));

          // Remove from pending sessions.
          // await PendingSessions.removePendingSessions([new PendingSession(session.handle)]);

          // Delete session data (bye!).
          await PaidSessions.removePaidSessionByWalletAddress({ address: session.wallet.address });

          return txId;
        }
      } catch (e) {
        console.log('Failed to mint', e);
        return false;
      }
    })
  );

  return res.status(200).json({
    error: !!jobs.find(job => false === job)?.length,
    jobs
  });
};
