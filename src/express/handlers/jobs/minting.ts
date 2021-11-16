import * as express from "express";

import { MAX_CHAIN_LOAD } from "../../../helpers/constants";
import { mintHandlesAndSend } from "../../../helpers/wallet";
import { handleExists } from "../../../helpers/graphql";
import { getChainLoad } from '../../../helpers/cardano';
import { PaidSessions } from '../../../models/firestore/collections/PaidSessions';
import { PaidSession } from '../../../models/PaidSession';
import { RefundableSessions } from "../../../models/firestore/collections/RefundableSessions";
import { RefundableSession } from "../../../models/RefundableSession";
import { asyncForEach, toLovelace } from "../../../helpers/utils";
import { Logger } from "../../../helpers/Logger";

export const mintPaidSessionsHandler = async (req: express.Request, res: express.Response) => {
  const load = await getChainLoad();

  if (!load || load > MAX_CHAIN_LOAD) {
    return res.status(200).json({
      error: false,
      message: 'Chain load is too high.'
    });
  }

  // TODO: get pending sessions from firestore
  const paidSessions: PaidSession[] = await PaidSessions.getPaidSessionsByStatus('pending');
  if (paidSessions.length < 1) {
    return res.status(200).json({
      error: false,
      message: 'No paid sessions!'
    });
  }

  // Filter out any possibly duplicated sessions.
  const sanitizedSessions: PaidSession[] = [];
  const duplicatePaidSessions: PaidSession[] = [];

  // check for duplicates
  await asyncForEach(paidSessions, async (session: PaidSession) => {
    // Make sure we don't have more than one session with the same handle.
    if (sanitizedSessions.some(s => s.handle === session.handle)) {
      duplicatePaidSessions.push(session);
      return;
    }

    // Make sure there isn't an existing handle on-chain.
    const { exists } = await handleExists(session.handle);
    if (exists) {
      duplicatePaidSessions.push(session);
      return;
    }

    // The rest are good for processing.
    sanitizedSessions.push(session);
  });

  // Move to refunds if necessary.
  if (duplicatePaidSessions.length > 0) {
    await RefundableSessions.addRefundableSessions(
      duplicatePaidSessions.map(s => new RefundableSession({
        amount: toLovelace(s.cost),
        handle: s.handle,
        wallet: s.wallet
      }))
    );

    // Remove from paid.
    await PaidSessions.sanitzeAndAddToDLQ(duplicatePaidSessions);
  }

  // Mint the handles!
  let txResponse;
  try {
    const txId = await mintHandlesAndSend(sanitizedSessions);
    txResponse = txId;
    Logger.log({ message: `Minted batch with transaction ID: ${txId}`, event: 'mintPaidSessionsHandler.mintHandlesAndSend' });

    // Delete sessions data once submitted.
    if (txId) {
      await PaidSessions.sanitzeAndAddToDLQ(sanitizedSessions);
    }

    // @TODO: We need a way to know that these sessions were submitted in a single transaction.
    // This is done by checking to see if the transaction is on chain.
    // 

  } catch (e) {
    Logger.log({ message: `Failed to mint batch: ${JSON.stringify(e)}`, event: 'mintPaidSessionsHandler.mintHandlesAndSend' });
    txResponse = false;
  }

  return res.status(200).json({
    error: txResponse === false,
    message: txResponse
  });
};
