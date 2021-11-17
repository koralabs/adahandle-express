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
import { LogCategory, Logger } from "../../../helpers/Logger";
import { CronJobLockName, StateData } from "../../../models/firestore/collections/StateData";
import { CollectionLimitName } from "../../../models/State";

const CRON_JOB_LOCK_NAME = CronJobLockName.MINT_PAID_SESSIONS_LOCK;
const COLLECTION_LIMIT_NAME = CollectionLimitName.PAID_SESSIONS_LIMIT;

export const mintPaidSessionsHandler = async (req: express.Request, res: express.Response) => {
  const stateData = await StateData.getStateData();
  if (stateData[CRON_JOB_LOCK_NAME]) {
    Logger.log({ message: `Cron job ${CRON_JOB_LOCK_NAME} is locked`, event: 'mintPaidSessionsHandler.locked', category: LogCategory.NOTIFY });
    return res.status(200).json({
      error: false,
      message: 'Cron is locked. Try again later.'
    });
  }

  const load = await getChainLoad();

  if (!load || load > MAX_CHAIN_LOAD) {
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
    await PaidSessions.removeAndAddToDLQ(duplicatePaidSessions);
  }

  // Mint the handles!
  let txResponse;
  try {
    const txId = await mintHandlesAndSend(sanitizedSessions);
    txResponse = txId;
    Logger.log({ message: `Minted batch with transaction ID: ${txId}`, event: 'mintPaidSessionsHandler.mintHandlesAndSend' });

    // Delete sessions data once submitted.
    if (txId) {
      await PaidSessions.updateSessionStatuses(txId, sanitizedSessions, 'submitted');
    }
  } catch (e) {
    Logger.log({ message: `Failed to mint batch: ${JSON.stringify(e)}. locking cron`, event: 'mintPaidSessionsHandler.mintHandlesAndSend.error', category: LogCategory.NOTIFY });

    // if anything goes wrong, lock the cron job and troubleshoot.
    await StateData.lockCron(CRON_JOB_LOCK_NAME);
    txResponse = false;
  }

  return res.status(200).json({
    error: txResponse === false,
    message: txResponse
  });
};
