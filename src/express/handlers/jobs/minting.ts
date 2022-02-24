import * as express from "express";

import { mintHandlesAndSend } from "../../../helpers/wallet";
import { handleExists } from "../../../helpers/graphql";
import { MintingCache } from '../../../models/firestore/collections/MintingCache';
import { awaitForEach } from "../../../helpers/utils";
import { LogCategory, Logger } from "../../../helpers/Logger";
import { MintingWallet, StateData } from "../../../models/firestore/collections/StateData";
import { ActiveSessions } from "../../../models/firestore/collections/ActiveSession";
import { ActiveSession, Status, WorkflowStatus } from "../../../models/ActiveSession";
import { getMintingWallet } from "../../../helpers/constants";

interface MintSessionsResponse {
  status: number
  error: boolean
  message: string,
  txId?: string
}

const mintPaidSessions = async (availableWallet: MintingWallet): Promise<MintSessionsResponse> => {
  const startTime = Date.now();
  const getLogMessage = (startTime: number, recordCount: number) => ({ message: `mintPaidSessions processed ${recordCount} records in ${Date.now() - startTime}ms`, event: 'mintPaidSessions.run', count: recordCount, milliseconds: Date.now() - startTime, category: LogCategory.METRIC });

  const state = await StateData.getStateData();
  if (state.chainLoad > state.chainLoadThresholdPercent) {
    return {
      status: 200,
      error: false,
      message: 'Chain load is too high.'
    }
  }

  const paidSessionsLimit = state.paidSessionsLimit;
  const paidSessions: ActiveSession[] = await ActiveSessions.getPaidPendingSessions({ limit: paidSessionsLimit });
  if (paidSessions.length < 1) {
    return {
      status: 200,
      error: false,
      message: 'No paid sessions!'
    }
  }

  const results = await ActiveSessions.updateWorkflowStatusAndTxIdForSessions('', '', paidSessions, WorkflowStatus.PROCESSING);
  if (results.some(result => !result)) {
    Logger.log({ message: 'Error setting "processing" status', event: 'mintPaidSessionsHandler.updateSessionStatuses.processing', category: LogCategory.NOTIFY });
    return {
      status: 400,
      error: true,
      message: 'Error setting "processing" status'
    }
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
    return {
      status: 200,
      error: false,
      message: 'No Handles to mint!'
    }
  }

  // Mint the handles!
  try {
    const txId = await mintHandlesAndSend(sanitizedSessions, availableWallet);

    await StateData.updateMintingWalletTxId(availableWallet, txId);

    Logger.log({ message: `Minted batch with transaction ID: ${txId}`, event: 'mintPaidSessionsHandler.mintHandlesAndSend' });
    Logger.log({ message: `Submitting ${sanitizedSessions.length} minted Handles for confirmation.`, event: 'mintPaidSessionsHandler.mintHandlesAndSend', count: sanitizedSessions.length, category: LogCategory.METRIC });

    const { walletId } = getMintingWallet(availableWallet.index);
    await ActiveSessions.updateWorkflowStatusAndTxIdForSessions(txId, walletId, sanitizedSessions, WorkflowStatus.SUBMITTED);

    const lastSessionDateAdded = Math.max(...sanitizedSessions.map(sess => sess.dateAdded ?? 0));
    if (lastSessionDateAdded) {
      state.lastMintingTimestamp = lastSessionDateAdded;
      StateData.upsertStateData(state)
    }

    Logger.log(getLogMessage(startTime, paidSessions.length));

    return {
      status: 200,
      error: false,
      message: 'Handles submitted successfully',
      txId
    }
  } catch (e) {
    // Log the failed transaction submission (will try again on next round).
    Logger.log({
      message: `Failed to mint batch: ${JSON.stringify(e)}, re-trying next time. Job details: ${JSON.stringify({
        refundableSessions,
        sanitizedSessions
      })}`, event: 'mintPaidSessionsHandler.mintHandlesAndSend.error', category: LogCategory.ERROR
    });
    await ActiveSessions.updateWorkflowStatusAndTxIdForSessions('', '', sanitizedSessions, WorkflowStatus.PENDING);
    await MintingCache.removeHandlesFromMintCache(sanitizedSessions.map(s => s.handle));
    await StateData.unlockMintingWallet(availableWallet);
    return {
      status: 500,
      error: true,
      message: 'Transaction submission failed.'
    }
  }
}

export const mintPaidSessionsHandler = async (req: express.Request, res: express.Response) => {
  let availableWallet: MintingWallet | null = null;
  try {
    availableWallet = await StateData.findAvailableMintingWallet();
    if (!availableWallet) {
      Logger.log({ message: 'No available wallet found', event: 'mintPaidSessionsHandler.availableWallet', category: LogCategory.NOTIFY });
      return res.status(200).json({
        error: false,
        message: 'No available minting wallets.'
      });
    }

    if (availableWallet.balance && availableWallet.balance < availableWallet.minBalance) {
      Logger.log({ message: `${availableWallet.id} balance is lower than minimum balance`, event: 'mintPaidSessionsHandler.availableWallet.balance', category: LogCategory.NOTIFY });
      return res.status(400).json({
        error: true,
        message: 'Not enough balance in wallet.'
      });
    }

    if (!await StateData.checkAndLockCron('mintPaidSessionsLock')) {
      return res.status(200).json({
        error: false,
        message: 'Mint Paid Sessions cron is locked. Try again later.'
      });
    }

    const { status, error, message, txId } = await mintPaidSessions(availableWallet);

    // Unlock the available wallet if there wasn't a transaction or an error occurred.
    if (!txId) {
      await StateData.unlockMintingWallet(availableWallet);
    }

    await StateData.unlockCron('mintPaidSessionsLock');

    return res.status(status).json({
      error,
      message
    });
  } catch (error) {
    await StateData.unlockCron('mintPaidSessionsLock');
    await StateData.unlockMintingWallet(availableWallet);
    return res.status(200).json({
      error: true,
      message: JSON.stringify(error)
    });
  }

};
