import * as express from "express";

import { PaidSessions } from '../../../models/firestore/collections/PaidSessions';
import { LogCategory, Logger } from "../../../helpers/Logger";
import { CronJobLockName, StateData } from "../../../models/firestore/collections/StateData";
import { getMintWalletServer } from "../../../helpers/wallet/cardano";
import { PaidSession } from "../../../models/PaidSession";
import { asyncForEach } from "../../../helpers/utils";
import { ApiTransactionStatusEnum, TransactionWallet } from "cardano-wallet-js";

const CRON_JOB_LOCK_NAME = CronJobLockName.MINT_CONFIRMED_LOCK;

export const mintConfirmedHandler = async (req: express.Request, res: express.Response) => {
  const stateData = await StateData.getStateData();
  if (stateData[CRON_JOB_LOCK_NAME]) {
    Logger.log({ message: `Cron job ${CRON_JOB_LOCK_NAME} is locked`, event: 'mintConfirmedHandler.locked', category: LogCategory.NOTIFY });
    return res.status(200).json({
      error: false,
      message: 'Mint confirmed cron is locked. Try again later.'
    });
  }

  // get paid sessions with status 'submitted'
  const paidSessions = await PaidSessions.getByStatus({ statusType: 'submitted' });
  const groupedPaidSessionsByTxIdMap = paidSessions.reduce<Map<string, PaidSession[]>>((acc, session) => {
    if (session.txId && !acc.has(session.txId)) {
      const sessions = acc.get(session.txId) ?? [];
      acc.set(session.txId, [...sessions]);
    }

    return acc;
  }, new Map());

  const mintingWallet = await getMintWalletServer();
  await asyncForEach<string>([...groupedPaidSessionsByTxIdMap.keys()], async (txId) => {
    let transaction: TransactionWallet | undefined;

    try {
      transaction = await mintingWallet.getTransaction(txId);
    } catch (error) {
      Logger.log({ message: JSON.stringify(error), event: 'mintConfirmedHandler.getTransaction', category: LogCategory.NOTIFY });
      // TODO: do we need to check graphql or set to pending?
      return;
    }

    const status = transaction?.status;
    const depth = transaction?.depth?.quantity;

    Logger.log({ message: `status: ${status} & depth: ${depth} for txId: ${txId}`, event: 'mintConfirmedHandler.getTransaction.details' });
    // check the wallet for block depth (Assurance level) is >= 5 set to 'confirmed'
    if (status === ApiTransactionStatusEnum.InLedger && depth >= 5) {
      await PaidSessions.updateSessionStatusesByTxId(txId, 'confirmed');
      return;
    }

    // if transaction isn't found or is "expired", revert back to 'pending'
    if (status === ApiTransactionStatusEnum.Expired) {
      // if transaction attempts is > 3, move to DLQ and notify team
      await PaidSessions.updateSessionStatusesByTxId(txId, 'pending');
    }
  });

  return res.status(200).json({
    error: false,
    message: 'success'
  });
};
