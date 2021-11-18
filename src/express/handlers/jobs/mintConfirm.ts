import * as express from "express";
import fetch from 'cross-fetch';

import { PaidSessions } from '../../../models/firestore/collections/PaidSessions';
import { LogCategory, Logger } from "../../../helpers/Logger";
import { CronJobLockName, StateData } from "../../../models/firestore/collections/StateData";
import { getMintWalletServer } from "../../../helpers/wallet/cardano";
import { PaidSession } from "../../../models/PaidSession";
import { asyncForEach } from "../../../helpers/utils";
import { ApiTransactionStatusEnum, TransactionWallet } from "cardano-wallet-js";
import { getMintingWalletId, getWalletEndpoint } from "../../../helpers/constants";

const CRON_JOB_LOCK_NAME = CronJobLockName.MINT_CONFIRM_LOCK;

export const mintConfirmHandler = async (req: express.Request, res: express.Response) => {
  const stateData = await StateData.getStateData();
  if (stateData[CRON_JOB_LOCK_NAME]) {
    Logger.log({ message: `Cron job ${CRON_JOB_LOCK_NAME} is locked`, event: 'mintConfirmHandler.locked', category: LogCategory.NOTIFY });
    return res.status(200).json({
      error: false,
      message: 'Mint confirm cron is locked. Try again later.'
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

  await asyncForEach<string>([...groupedPaidSessionsByTxIdMap.keys()], async (txId) => {
    let transactionResponse: Response | undefined;

    try {
      const walletEndpoint = getWalletEndpoint();
      const mintingWalletID = getMintingWalletId();
      transactionResponse = await fetch(
        `${walletEndpoint}/wallets/${mintingWalletID}/transactions/${txId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      Logger.log({ message: JSON.stringify(error), event: 'mintConfirmHandler.getTransaction', category: LogCategory.NOTIFY });
      return;
    }

    const responseStatus = transactionResponse.status;
    const transaction = await transactionResponse.json();
    console.log(JSON.stringify(transaction));
    const status = transaction?.status;
    const depth = transaction?.depth?.quantity;

    Logger.log({ message: `status: ${status} & depth: ${depth} for txId: ${txId}`, event: 'mintConfirmHandler.getTransaction.details' });
    // check the wallet for block depth (Assurance level) is >= 5 set to 'confirmed'
    if (status === ApiTransactionStatusEnum.InLedger && depth >= 5) {
      await PaidSessions.updateSessionStatusesByTxId(txId, 'confirmed');
      return;
    }

    // if transaction is "expired", revert back to 'pending'
    if (404 === responseStatus || status === ApiTransactionStatusEnum.Expired) {
      // if transaction attempts is > 3, move to DLQ and notify team
      await PaidSessions.updateSessionStatusesByTxId(txId, 'pending');
    }
  });

  return res.status(200).json({
    error: false,
    message: 'success'
  });
};
