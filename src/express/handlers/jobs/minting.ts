import * as express from "express";

import { MAX_CHAIN_LOAD } from "../../../helpers/constants";
import { mintHandlesAndSend } from "../../../helpers/wallet";
import { handleExists } from "../../../helpers/graphql";
import { PaidSessions } from '../../../models/firestore/collections/PaidSessions';
import { MintingCache } from '../../../models/firestore/collections/MintingCache';
import { PaidSession } from '../../../models/PaidSession';
import { RefundableSessions } from "../../../models/firestore/collections/RefundableSessions";
import { RefundableSession } from "../../../models/RefundableSession";
import { awaitForEach, toLovelace } from "../../../helpers/utils";
import { LogCategory, Logger } from "../../../helpers/Logger";
import { CronJobLockName, StateData } from "../../../models/firestore/collections/StateData";

const mintPaidSessions = async (req: express.Request, res: express.Response) => {
  const stateData = await StateData.getStateData();
  if (stateData[CronJobLockName.MINT_PAID_SESSIONS_LOCK]) {
    Logger.log({ message: `Cron job ${CronJobLockName.MINT_PAID_SESSIONS_LOCK} is locked`, event: 'mintPaidSessionsHandler.locked', category: LogCategory.NOTIFY });
    return res.status(200).json({
      error: false,
      message: 'Minting cron is locked. Try again later.'
    });
  }
  const startTime = Date.now();
  const getLogMessage = (startTime: number, recordCount: number) => ({ message: `mintPaidSessions processed ${recordCount} records in ${Date.now() - startTime}ms`, event: 'mintPaidSessions.run', count: recordCount, milliseconds: Date.now() - startTime, category: LogCategory.METRIC });

  if (stateData?.chainLoad > MAX_CHAIN_LOAD) {
    return res.status(200).json({
      error: false,
      message: 'Chain load is too high.'
    });
  }

  const paidSessionsLimit = stateData.paidSessionsLimit;
  const paidSessions: PaidSession[] = await PaidSessions.getByStatus({ statusType: 'pending', limit: paidSessionsLimit });
  if (paidSessions.length < 1) {
    return res.status(200).json({
      error: false,
      message: 'No paid sessions!'
    });
  }

  const results = await PaidSessions.updateSessionStatuses('', paidSessions, 'processing');
  if (results.some(result => !result)) {
    Logger.log({ message: 'Error setting "processing" status', event: 'mintPaidSessionsHandler.updateSessionStatuses.processing', category: LogCategory.NOTIFY });
    return res.status(400).json({
      error: true,
      message: 'Error setting "processing" status'
    });
  }

  // Filter out any possibly duplicated sessions.
  const sanitizedSessions: PaidSession[] = [];
  const refundableSessions: PaidSession[] = [];

  // check for duplicates
  await awaitForEach(paidSessions, async (session: PaidSession) => {
    // Make sure there isn't an existing handle on-chain.
    const { exists: existsOnChain } = await handleExists(session.handle);
    const existingSessions = await PaidSessions.getByHandles(session.handle);
    const inMintingCache = await MintingCache.addHandleToMintCache(session.handle) == false;
    if (existsOnChain || existingSessions.length > 1 || inMintingCache) {
      Logger.log({ message: `Handle ${session.handle} already exists on-chain or in DB`, event: 'mintPaidSessionsHandler.handleExists', category: LogCategory.NOTIFY });
      refundableSessions.push(session);
      return;
    }

    // The rest are good for processing.
    sanitizedSessions.push(session);
  });

  // Move to refunds if necessary.
  if (refundableSessions.length > 0) {
    await RefundableSessions.addRefundableSessions(
      refundableSessions.map(s => new RefundableSession({
        amount: toLovelace(s.cost),
        handle: s.handle,
        paymentAddress: s.paymentAddress,
        returnAddress: s.returnAddress,
        createdBySystem: s.createdBySystem
      }))
    );

    // Remove from paid.
    await PaidSessions.removeAndAddToDLQ(refundableSessions);
  }

  // If no handles to mint, abort.
  if (sanitizedSessions.length < 1) {
    Logger.log({ message: `There were no Handles to mint after sanitizing. Job details: ${JSON.stringify({
      refundableSessions,
      sanitizedSessions
    })}`, event: 'mintPaidSessionsHandler.mintHandlesAndSend', category: LogCategory.INFO });
    return res.status(200).json({
      error: false,
      message: 'No Handles to mint!'
    });
  }

  // Mint the handles!
  try {
    const txId = await mintHandlesAndSend(sanitizedSessions);
    Logger.log({ message: `Minted batch with transaction ID: ${txId}`, event: 'mintPaidSessionsHandler.mintHandlesAndSend' });
    Logger.log({ message: `Submitting ${sanitizedSessions.length} minted Handles for confirmation.`, event: 'mintPaidSessionsHandler.mintHandlesAndSend', count: sanitizedSessions.length, category: LogCategory.METRIC });
    await PaidSessions.updateSessionStatuses(txId, sanitizedSessions, 'submitted');

    stateData.lastMintingTimestamp = paidSessions[paidSessions.length - 1].dateAdded;
    StateData.upsertStateData(stateData)
    
    Logger.log(getLogMessage(startTime, paidSessions.length))
    return res.status(200).json({
      error: false,
      message: txId
    });
  } catch (e) {
    // Log the failed transaction submission (will try again on next round).
    Logger.log({ message: `Failed to mint batch: ${JSON.stringify(e)}, re-trying next time. Job details: ${JSON.stringify({
      refundableSessions,
      sanitizedSessions
    })}`, event: 'mintPaidSessionsHandler.mintHandlesAndSend.error', category: LogCategory.ERROR });
    await PaidSessions.updateSessionStatuses('', sanitizedSessions, 'pending');
    return res.status(500).json({
      error: true,
      message: 'Transaction submission failed.'
    });
  }
}

export const mintPaidSessionsHandler = async (req: express.Request, res: express.Response) => {
  try {
    const result = await mintPaidSessions(req, res);
    return result;
  } catch (error) {
    return res.status(200).json({
      error: true,
      message: JSON.stringify(error)
    });
  }

};
