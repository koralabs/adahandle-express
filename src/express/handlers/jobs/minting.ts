import * as express from "express";
import { readFile, unlinkSync } from 'fs';
import { resolve } from 'path';
import { getS3 } from "../../../helpers/aws";
import { mintHandlesAndSend } from "../../../helpers/wallet";
import { handleExists } from "../../../helpers/graphql";
import { MintingCache } from '../../../models/firestore/collections/MintingCache';
import { asyncForEach, awaitForEach, toLovelace } from "../../../helpers/utils";
import { LogCategory, Logger } from "../../../helpers/Logger";
import { MintingWallet, StateData } from "../../../models/firestore/collections/StateData";
import { SettingsRepo } from "../../../models/firestore/collections/SettingsRepo";
import { ActiveSessions } from "../../../models/firestore/collections/ActiveSession";
import { ActiveSession, Status, WorkflowStatus } from "../../../models/ActiveSession";
import { getMintingWallet } from "../../../helpers/constants";
import { CronState, State } from "../../../models/State";

interface MintSessionsResponse {
  status: number
  error: boolean
  message: string,
  txId?: string
}

const mintPaidSessions = async (availableWallet: MintingWallet, state: State): Promise<MintSessionsResponse> => {
  const startTime = Date.now();
  const getLogMessage = (startTime: number, recordCount: number) => ({ message: `mintPaidSessions processed ${recordCount} records in ${Date.now() - startTime}ms`, event: 'mintPaidSessions.run', count: recordCount, milliseconds: Date.now() - startTime, category: LogCategory.METRIC });

  const settings = await SettingsRepo.getSettings();
  if (state.chainLoad > settings.chainLoadThresholdPercent) {
    return {
      status: 200,
      error: false,
      message: 'Chain load is too high.'
    }
  }

  const paidSessionsLimit = settings.paidSessionsLimit;
  const paidSessions: ActiveSession[] = await ActiveSessions.getPaidPendingSessions({ limit: paidSessionsLimit });

  Logger.log({ message: `Found paid sessions: ${JSON.stringify(paidSessions)}`, event: 'mintPaidSessionsHandler.foundPaidSessions', category: LogCategory.INFO });

  if (paidSessions.length < 1) {
    return {
      status: 200,
      error: false,
      message: 'No paid sessions!'
    }
  }

  const results = await ActiveSessions.setPendingWorkflowStatusToProcessing(paidSessions);
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

  let txId: string;
  // Mint the handles!

  Logger.log({ message: `Attempting to mint: ${JSON.stringify(sanitizedSessions)}`, event: 'mintPaidSessionsHandler.attemptingToMint', category: LogCategory.INFO });

  try {
    txId = await mintHandlesAndSend(sanitizedSessions, availableWallet);

    Logger.log({ message: `Minted batch with transaction ID: ${txId}`, event: 'mintPaidSessionsHandler.mintHandlesAndSend' });
    Logger.log({ message: `Submitting ${sanitizedSessions.length} minted Handles for confirmation.`, event: 'mintPaidSessionsHandler.mintHandlesAndSend', count: sanitizedSessions.length, category: LogCategory.METRIC });

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

  try {
    await StateData.updateMintingWalletTxId(availableWallet, txId);
    const { walletId } = getMintingWallet(availableWallet.index);
    await ActiveSessions.updateWorkflowStatusAndTxIdForSessions(txId, walletId, sanitizedSessions, WorkflowStatus.SUBMITTED);

    const lastSessionDateAdded = Math.max(...sanitizedSessions.map(sess => sess.dateAdded ?? 0));
    if (lastSessionDateAdded) {
      state.lastMintingTimestamp = lastSessionDateAdded;
      StateData.upsertStateData(state)
    }

    await backupNftsToS3(sanitizedSessions);

    Logger.log(getLogMessage(startTime, paidSessions.length));

    return {
      status: 200,
      error: false,
      message: 'Handles submitted successfully',
      txId
    }
  }
  catch (e) {
    // Since we already minted, it's safe to unlock the cron
    await StateData.unlockCron('mintPaidSessionsLock');
    Logger.log({ message: `Post-minting processing failed: ${JSON.stringify(e)}`, category: LogCategory.ERROR, event: 'mintPaidSessions.postMintProcessing' });
    return {
      status: 500,
      error: true,
      message: 'Transaction completed, but post-mint processing failed',
      txId
    }
  }
}

export const mintPaidSessionsHandler = async (req: express.Request, res: express.Response) => {
  Logger.log({ message: `!!!STARTING MINTING!!!`, event: 'mintPaidSessionsHandler.startMinting', category: LogCategory.INFO });

  const state = await StateData.getStateData();
  let availableWallet: MintingWallet | null = null;
  try {
    availableWallet = await StateData.findAvailableMintingWallet();

    Logger.log({ message: `Found ${JSON.stringify(availableWallet)}`, event: 'mintPaidSessionsHandler.foundAvailableWallet', category: LogCategory.INFO });

    if (!availableWallet) {
      if (await StateData.allMintingWalletsAreLockedWithNoTransactions()) {
        Logger.log({ message: 'All wallets are locked with no transaction IDs', event: 'mintPaidSessionsHandler.availableWallet', category: LogCategory.NOTIFY });
      }
      else {
        Logger.log('No available minting wallets.');
      }

      return res.status(200).json({
        error: false,
        message: 'No available minting wallets.'
      });
    }

    if (availableWallet.balance && availableWallet.balance < availableWallet.minBalance) {
      await StateData.unlockMintingWallet(availableWallet);
      Logger.log({ message: `Low balance notification for ${availableWallet.id}`, event: 'mintPaidSessionsHandler.availableWallet.balance', category: LogCategory.NOTIFY });
    }

    if (availableWallet.balance && availableWallet.balance < toLovelace(100)) {
      Logger.log({ message: `${availableWallet.id} balance is lower than 100 ADA. LOCKING`, event: 'mintPaidSessionsHandler.availableWallet.balance', category: LogCategory.NOTIFY });
      return res.status(400).json({
        error: true,
        message: `Not enough balance in wallet ${availableWallet.id}`
      });
    }

    // This cron works slightly differently since multiple servers are allowed to call it.
    if ([CronState.LOCKED, CronState.DEPLOYING].includes(state.mintPaidSessionsLock)) {
      await StateData.unlockMintingWallet(availableWallet);
      return res.status(200).json({
        error: false,
        message: 'Mint Paid Sessions cron is locked. Try again later.'
      });
    }

    StateData.lockCron('mintPaidSessionsLock');

    const { status, error, message, txId } = await mintPaidSessions(availableWallet, state);

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

const backupNftsToS3 = async (sessions: ActiveSession[]) => {
  await asyncForEach<ActiveSession, void>(sessions, async (session) => {

    const outputPath = resolve(__dirname, '../../../../bin');
    const outputSlug = `${outputPath}/${session.handle}.jpg`;
    const s3 = getS3();
    readFile(outputSlug, function (err, data) {
      if (err) throw err;
      s3.putObject({ Bucket: 'adahandle-nfts', Key: `${session.handle}.jpg`, Body: data, Metadata: { ipfsHash: session.ipfsHash || '' } }, (err, data) => {
        if (err) throw err;
        unlinkSync(outputSlug);
      });
    });
  });
}