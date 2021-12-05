import * as express from "express";

import { MAX_CHAIN_LOAD } from "../../../helpers/constants";
import { mintHandlesAndSend } from "../../../helpers/wallet";
import { handleExists } from "../../../helpers/graphql";
import { PaidSessions } from '../../../models/firestore/collections/PaidSessions';
import { PaidSession } from '../../../models/PaidSession';
import { RefundableSessions } from "../../../models/firestore/collections/RefundableSessions";
import { RefundableSession } from "../../../models/RefundableSession";
import { asyncForEach, toLovelace } from "../../../helpers/utils";
import { LogCategory, Logger } from "../../../helpers/Logger";
import { CronJobLockName, StateData } from "../../../models/firestore/collections/StateData";
import { CollectionLimitName } from "../../../models/State";

const CRON_JOB_LOCK_NAME = CronJobLockName.MINT_PAID_SESSIONS_LOCK;
const COLLECTION_LIMIT_NAME = CollectionLimitName.PAID_SESSIONS_LIMIT;

const mintPaidSessions = async (req: express.Request, res: express.Response) => {
  const stateData = await StateData.getStateData();
  if (stateData[CRON_JOB_LOCK_NAME]) {
    Logger.log({ message: `Cron job ${CRON_JOB_LOCK_NAME} is locked`, event: 'mintPaidSessionsHandler.locked', category: LogCategory.NOTIFY });
    return res.status(200).json({
      error: false,
      message: 'Minting cron is locked. Try again later.'
    });
  }

  if (stateData?.chainLoad > MAX_CHAIN_LOAD) {
    return res.status(200).json({
      error: false,
      message: 'Chain load is too high.'
    });
  }

  const paidSessionsLimit = stateData[COLLECTION_LIMIT_NAME];
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
  await asyncForEach(paidSessions, async (session: PaidSession) => {
    // Make sure there isn't an existing handle on-chain.
    const { exists: existsOnChain } = await handleExists(session.handle);
    const existingSessions = await PaidSessions.getByHandles(session.handle);
    if (existsOnChain || existingSessions.length > 1) {
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
        wallet: s.wallet
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
    return res.status(200).json({
      error: false,
      message: txId
    });
  } catch (e) {
    // Log the failed transaction submission (will try again on next round).
    await PaidSessions.updateSessionStatuses('', sanitizedSessions, 'pending');
    Logger.log({ message: `Failed to mint batch: ${JSON.stringify(e)}, re-trying next time. Job details: ${JSON.stringify({
      refundableSessions,
      sanitizedSessions
    })}`, event: 'mintPaidSessionsHandler.mintHandlesAndSend.error', category: LogCategory.ERROR });
    return res.status(500).json({
      error: true,
      message: 'Transaction submission failed.'
    });
  }
}

export const mintPaidSessionsHandler = async (req: express.Request, res: express.Response) => {
  const startTime = Date.now();
  const getLogMessage = (startTime: number) => ({ message: `mintPaidSessionsHandler completed in ${Date.now() - startTime}ms`, event: 'mintPaidSessionsHandler.run', milliseconds: Date.now() - startTime, category: LogCategory.METRIC });

  try {
    const result = await mintPaidSessions(req, res);
    Logger.log(getLogMessage(startTime));
    return result;
  } catch (error) {
    Logger.log(getLogMessage(startTime));
    return res.status(200).json({
      error: true,
      message: JSON.stringify(error)
    });
  }

};
