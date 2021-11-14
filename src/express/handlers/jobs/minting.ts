import * as express from "express";

import { MAX_CHAIN_LOAD } from "../../../helpers/constants";
import { mintHandlesAndSend } from "../../../helpers/wallet";
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

  console.log(JSON.stringify(paidSessions));

  // Filter out any possibly duplicated sessions.
  const duplicatePaidSessions: PaidSession[] = [];
  const sanitizedSessions = paidSessions.reduce((sanitized: PaidSession[], curr: PaidSession) => {
    if (sanitized.some(s => s.handle === curr.handle)) {
      duplicatePaidSessions.push(curr);
      return sanitized;
    }

    sanitized.push(curr);
    return sanitized;
  }, []);

  if (duplicatePaidSessions.length > 0) {
    // Log in refunds.
    await RefundableSessions.addRefundableSessions(
      duplicatePaidSessions.map(s => new RefundableSession({
        amount: toLovelace(s.cost),
        handle: s.handle,
        wallet: s.wallet
      }))
    );

    // Remove from paid.
    await PaidSessions.removePaidSessions(duplicatePaidSessions);
  }

  // Mint the handles!
  let txResponse;
  try {
    const txId = await mintHandlesAndSend(sanitizedSessions);
    txResponse = txId;

    // @TODO: We need a way to know that these sessions were submitted in a single transaction.
  } catch (e) {
    console.log('Failed to mint', e);
    txResponse = false;
  }

  // const jobs = await Promise.all(
  //   batch.map(async session => {

  //     // Ensure no double mint.
  //     const { exists } = await handleExists(session.handle);
  //     const minted = await MintedHandles.getMintedHandles();

  //     if (exists || minted?.some(handle => handle.handleName === session.handle)) {
  //       console.warn(`Handle (${session.handle} already minted!. Moving to refund queue.`);
  //       try {
  //         await RefundableSessions.addRefundableSessions([
  //           new RefundableSession({
  //             wallet: session.wallet,
  //             amount: toLovelace(session.cost),
  //             handle: session.handle,
  //           })
  //         ]);
  //         await PaidSessions.removePaidSessions([session]);
  //       } catch (e) {
  //         console.log('Trying to record a refund from an attempted double mint, but failed.', session.wallet);
  //       }

  //       return false;
  //     }

  //     // Mint the handle!
  //     try {
  //       console.info('Attempting to mint the handle!');
  //       const txId = await mintHandlesAndSend(session);
  //       if (txId) {
  //         // Add minted handle to our internal database.
  //         await MintedHandles.addMintedHandle(new MintedHandle(session.handle));

  //         // Remove from pending sessions.
  //         // await PendingSessions.removePendingSessions([new PendingSession(session.handle)]);

  //         // Delete session data (bye!).
  //         await PaidSessions.removePaidSessionByWalletAddress({ address: session.wallet.address });

  //         return txId;
  //       }
  //     } catch (e) {
  //       console.log('Failed to mint', e);
  //       return false;
  //     }
  //   })
  // );

  return res.status(200).json({
    error: txResponse === false,
    message: txResponse
  });
};
