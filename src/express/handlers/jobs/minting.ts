import * as express from "express";

import { mintHandlesAndSend } from "../../../helpers/wallet";
import { handleExists } from "../../../helpers/graphql";
import { MintingCache } from '../../../models/firestore/collections/MintingCache';
import { awaitForEach } from "../../../helpers/utils";
import { LogCategory, Logger } from "../../../helpers/Logger";
import { MintingWallet, StateData } from "../../../models/firestore/collections/StateData";
import { ActiveSessions } from "../../../models/firestore/collections/ActiveSession";
import { ActiveSession, Status, WorkflowStatus } from "../../../models/ActiveSession";

const mintPaidSessions = async (res: express.Response, availableWallet: MintingWallet) => {
  const startTime = Date.now();
  const getLogMessage = (startTime: number, recordCount: number) => ({ message: `mintPaidSessions processed ${recordCount} records in ${Date.now() - startTime}ms`, event: 'mintPaidSessions.run', count: recordCount, milliseconds: Date.now() - startTime, category: LogCategory.METRIC });

  const state = await StateData.getStateData();
  if (state.chainLoad > state.chainLoadThresholdPercent) {

    return res.status(200).json({
      error: false,
      message: 'Chain load is too high.'
    });
  }

  const paidSessionsLimit = state.paidSessionsLimit;
  const paidSessions: ActiveSession[] = await ActiveSessions.getPaidPendingSessions({ limit: paidSessionsLimit });
  if (paidSessions.length < 1) {
    return res.status(200).json({
      error: false,
      message: 'No paid sessions!'
    });
  }

  const results = await ActiveSessions.updateWorkflowStatusAndTxIdForSessions('', paidSessions, WorkflowStatus.PROCESSING);
  if (results.some(result => !result)) {
    Logger.log({ message: 'Error setting "processing" status', event: 'mintPaidSessionsHandler.updateSessionStatuses.processing', category: LogCategory.NOTIFY });
    return res.status(400).json({
      error: true,
      message: 'Error setting "processing" status'
    });
  }

  // Filter out any possibly duplicated sessions.
  const sanitizedSessions: ActiveSession[] = [];
  const refundableSessions: ActiveSession[] = [];

  // check for duplicates
  await awaitForEach(paidSessions, async (session: ActiveSession) => {
    // Make sure there isn't an existing handle on-chain.
    const { exists: existsOnChain } = await handleExists(session.handle);
    const existingSessions = await ActiveSessions.getByHandle(session.handle);
    const isAdded = await MintingCache.addHandleToMintCache(session.handle);
    const inMintingCache = isAdded === false;
    if (existsOnChain || existingSessions.filter(s => s.status === Status.PAID).length > 1 || inMintingCache) {
      Logger.log({ message: `Handle ${session.handle} already exists on-chain or in DB`, event: 'mintPaidSessionsHandler.handleExists', category: LogCategory.NOTIFY });
      refundableSessions.push(session);
      return;
    }

    // The rest are good for processing.
    sanitizedSessions.push(session);
  });

  // Move to refunds if necessary.
  if (refundableSessions.length > 0) {
    const items = refundableSessions.map(s => new ActiveSession({
      ...s,
      refundAmount: s.cost,
      status: Status.REFUNDABLE,
      workflowStatus: WorkflowStatus.PENDING,
    }));
    await ActiveSessions.updateSessions(items);
  }

  // If no handles to mint, abort.
  if (sanitizedSessions.length < 1) {
    Logger.log({
      message: `There were no Handles to mint after sanitizing. Job details: ${JSON.stringify({
        refundableSessions,
        sanitizedSessions
      })}`, event: 'mintPaidSessionsHandler.mintHandlesAndSend', category: LogCategory.INFO
    });
    return res.status(200).json({
      error: false,
      message: 'No Handles to mint!'
    });
  }

  // Mint the handles!
  try {
    const txId = await mintHandlesAndSend(sanitizedSessions, availableWallet);

    await StateData.updateMintingWalletTxId(availableWallet, txId);

    Logger.log({ message: `Minted batch with transaction ID: ${txId}`, event: 'mintPaidSessionsHandler.mintHandlesAndSend' });
    Logger.log({ message: `Submitting ${sanitizedSessions.length} minted Handles for confirmation.`, event: 'mintPaidSessionsHandler.mintHandlesAndSend', count: sanitizedSessions.length, category: LogCategory.METRIC });
    await ActiveSessions.updateWorkflowStatusAndTxIdForSessions(txId, sanitizedSessions, WorkflowStatus.SUBMITTED);

    const lastSessionDateAdded = Math.max(...sanitizedSessions.map(sess => sess.dateAdded ?? 0));
    if (lastSessionDateAdded) {
      state.lastMintingTimestamp = lastSessionDateAdded;
      StateData.upsertStateData(state)
    }

    Logger.log(getLogMessage(startTime, paidSessions.length));
    return res.status(200).json({
      error: false,
      message: txId
    });
  } catch (e) {
    // Log the failed transaction submission (will try again on next round).
    Logger.log({
      message: `Failed to mint batch: ${JSON.stringify(e)}, re-trying next time. Job details: ${JSON.stringify({
        refundableSessions,
        sanitizedSessions
      })}`, event: 'mintPaidSessionsHandler.mintHandlesAndSend.error', category: LogCategory.ERROR
    });
    await ActiveSessions.updateWorkflowStatusAndTxIdForSessions('', sanitizedSessions, WorkflowStatus.PENDING);
    await MintingCache.removeHandlesFromMintCache(sanitizedSessions.map(s => s.handle));
    return res.status(500).json({
      error: true,
      message: 'Transaction submission failed.'
    });
  }
}

export const mintPaidSessionsHandler = async (req: express.Request, res: express.Response) => {
  let availableWallet: MintingWallet | null = null;
  try {

    if (!await StateData.checkAndLockCron('mintPaidSessionsLock')) {
      return res.status(200).json({
        error: false,
        message: 'Mint Paid Sessions cron is locked. Try again later.'
      });
    }

    availableWallet = await StateData.findAvailableMintingWallet();
    if (!availableWallet) {
      Logger.log({ message: 'No available wallet found', event: 'mintPaidSessionsHandler.availableWallet', category: LogCategory.NOTIFY });
      return res.status(200).json({
        error: false,
        message: 'No available wallets.'
      });
    }

    const result = await mintPaidSessions(res, availableWallet);

    await StateData.unlockCron('mintPaidSessionsLock');

    return result;
  } catch (error) {
    await StateData.unlockCron('mintPaidSessionsLock');
    await StateData.unlockMintingWallet(availableWallet);
    return res.status(200).json({
      error: true,
      message: JSON.stringify(error)
    });
  }

};
