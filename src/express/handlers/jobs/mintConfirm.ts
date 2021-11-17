import * as express from "express";

import { PaidSessions } from '../../../models/firestore/collections/PaidSessions';
import { LogCategory, Logger } from "../../../helpers/Logger";
import { CronJobLockName, StateData } from "../../../models/firestore/collections/StateData";
import { getMintWalletServer } from "../../../helpers/wallet/cardano";
import { PaidSession } from "../../../models/PaidSession";
import { asyncForEach } from "../../../helpers/utils";
import { ApiTransactionStatusEnum } from "cardano-wallet-js";

const CRON_JOB_LOCK_NAME = CronJobLockName.MINT_CONFIRMED_LOCK;

export const mintConfirmedHandler = async (req: express.Request, res: express.Response) => {
  const stateData = await StateData.getStateData();
  if (stateData[CRON_JOB_LOCK_NAME]) {
    Logger.log({ message: `Cron job ${CRON_JOB_LOCK_NAME} is locked`, event: 'mintConfirmedHandler.locked', category: LogCategory.NOTIFY });
    return res.status(200).json({
      error: false,
      message: 'Cron is locked. Try again later.'
    });
  }

  // get paid sessions with status 'submitted'
  // TODO: determine how to handle limit... 
  const paidSessions = await PaidSessions.getByStatus({ statusType: 'submitted', limit: 10000 });
  const groupedPaidSessionsByTxIdMap = paidSessions.reduce<Map<string, PaidSession[]>>((acc, session) => {
    if (session.txId && !acc.has(session.txId)) {
      const sessions = acc.get(session.txId) ?? [];
      acc.set(session.txId, [...sessions]);
    }

    return acc;
  }, new Map());

  const mintingWallet = await getMintWalletServer();
  await asyncForEach<string>([...groupedPaidSessionsByTxIdMap.keys()], async (txId) => {
    const transaction = await mintingWallet.getTransaction(txId);
    const status = transaction.status;
    const depth = transaction.depth?.quantity;

    // check the wallet for block depth (Assurance level) is >= 5 set to 'confirmed'
    const sessions = groupedPaidSessionsByTxIdMap.get(txId) ?? [];
    if (status === ApiTransactionStatusEnum.InLedger && depth >= 5) {
      await PaidSessions.updateSessionStatusesByTxId(txId, sessions, 'confirmed');
      return;
    }

    // if transaction isn't found or is "expired", revert back to 'pending'
    if (status === ApiTransactionStatusEnum.Expired) {
      // if transaction attempts is > 3, move to DLQ and notify team
      await PaidSessions.updateSessionStatusesByTxId(txId, sessions, 'pending');
    }
  });

  return res.status(200).json({
    error: false,
    message: 'success'
  });
};
