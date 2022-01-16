import * as express from "express";
import fetch from 'cross-fetch';

import { PaidSessions } from '../../../models/firestore/collections/PaidSessions';
import { LogCategory, Logger } from "../../../helpers/Logger";
import { StateData } from "../../../models/firestore/collections/StateData";
import { PaidSession } from "../../../models/PaidSession";
import { awaitForEach } from "../../../helpers/utils";
import { ApiTransactionStatusEnum, TransactionWallet } from "cardano-wallet-js";
import { getMintingWalletId, getWalletEndpoint } from "../../../helpers/constants";

export const mintConfirmHandler = async (req: express.Request, res: express.Response) => {
  const startTime = Date.now();
  const getLogMessage = (startTime: number, recordCount: number) => ({ message: `mintConfirmHandler processed ${recordCount} records in ${Date.now() - startTime}ms`, event: 'mintConfirmHandler.run', count: recordCount, milliseconds: Date.now() - startTime, category: LogCategory.METRIC });

  if (!await StateData.checkAndLockCron('mintConfirmLock')){
    return res.status(200).json({
      error: false,
      message: 'Mint Confirm cron is locked. Try again later.'
    });
  }  
  
  const state = await StateData.getStateData();

  const limit = state.mintConfirmPaidSessionsLimit;
  // get paid sessions with status 'submitted'
  const paidSessions = await PaidSessions.getByStatus({ statusType: 'submitted', limit });
  const groupedPaidSessionsByTxIdMap = paidSessions.reduce<Map<string, PaidSession[]>>((acc, session) => {
    if (session.txId) {
      const sessions = acc.get(session.txId) ?? [];
      acc.set(session.txId, [...sessions, session]);
    }
    return acc;
  }, new Map());

  await awaitForEach<string>([...groupedPaidSessionsByTxIdMap.keys()], async (txId) => {
    let transactionResponse: Response | undefined;

    try {
      const walletEndpoint = getWalletEndpoint();
      const mintingWalletID = getMintingWalletId();
      transactionResponse = await fetch(
        `${walletEndpoint}/wallets/${mintingWalletID}/transactions/${txId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      Logger.log({ message: JSON.stringify(error), event: 'mintConfirmHandler.getTransaction', category: LogCategory.NOTIFY });
      return;
    }

    const transaction = await transactionResponse.json();
    const status = transaction?.status;
    const depth = transaction?.depth?.quantity;

    Logger.log({ message: `status: ${status} & depth: ${depth} for txId: ${txId}`, event: 'mintConfirmHandler.getTransaction.details' });
    // check the wallet for block depth (Assurance level) is >= 5 set to 'confirmed'
    if (status === ApiTransactionStatusEnum.InLedger && depth >= 5) {
      await PaidSessions.updateSessionStatusesByTxId(txId, 'confirmed');
      return;
    }

    // if transaction is "expired", revert back to 'pending'
    if (status === ApiTransactionStatusEnum.Expired) {
      // if transaction attempts is > 3, move to DLQ and notify team
      await PaidSessions.updateSessionStatusesByTxId(txId, 'expired');
    }
  });

  await StateData.unlockCron('mintConfirmLock');
  Logger.log(getLogMessage(startTime, paidSessions.length));

  return res.status(200).json({
    error: false,
    message: 'success'
  });
};
