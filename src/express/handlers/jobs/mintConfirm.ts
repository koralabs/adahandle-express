import * as express from "express";
import fetch from 'cross-fetch';
import { LogCategory, Logger } from "../../../helpers/Logger";
import { StateData } from "../../../models/firestore/collections/StateData";
import { SettingsRepo } from "../../../models/firestore/collections/SettingsRepo";
import { awaitForEach } from "../../../helpers/utils";
import { ApiTransactionStatusEnum } from "cardano-wallet-js";
import { getWalletEndpoint } from "../../../helpers/constants";
import { ActiveSessions } from "../../../models/firestore/collections/ActiveSession";
import { ActiveSession, WorkflowStatus } from "../../../models/ActiveSession";
import { CronState } from "../../../models/State";

export const mintConfirmHandler = async (req: express.Request, res: express.Response) => {
  const startTime = Date.now();
  const getLogMessage = (startTime: number, recordCount: number) => ({ message: `mintConfirmHandler processed ${recordCount} records in ${Date.now() - startTime}ms`, event: 'mintConfirmHandler.run', count: recordCount, milliseconds: Date.now() - startTime, category: LogCategory.METRIC });

  const state = await StateData.getStateData();

  // This cron doesn't need to lock, but it shouldn't run if it is.
  if ([CronState.LOCKED, CronState.DEPLOYING].includes(state.mintPaidSessionsLock)) {
    return res.status(200).json({
      error: false,
      message: 'Mint confirm cron is locked. Try again later.'
    });
  }

  const settings = await SettingsRepo.getSettings();

  const limit = settings.mintConfirmPaidSessionsLimit;
  // get paid sessions with status 'submitted'
  const paidSessions = await ActiveSessions.getPaidSubmittedSessions({ limit });
  const groupedPaidSessionsByTxIdMap = paidSessions.reduce<Map<string, ActiveSession[]>>((acc, session) => {
    if (session.txId) {
      const sessions = acc.get(session.txId) ?? [];
      acc.set(session.txId, [...sessions, session]);
    }
    return acc;
  }, new Map());

  await awaitForEach<string>([...groupedPaidSessionsByTxIdMap.keys()], async (txId) => {
    let transactionResponse: Response | undefined;

    const sessions = groupedPaidSessionsByTxIdMap.get(txId) as ActiveSession[];
    const mintingWalletID = sessions[0].walletId;

    try {
      const walletEndpoint = getWalletEndpoint();
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
      await ActiveSessions.updatePaidSessionsWorkflowStatusesByTxId(txId, WorkflowStatus.CONFIRMED);
      await StateData.unlockMintingWalletByTxId(txId);
      return;
    }

    // if transaction is "expired", revert back to 'pending'
    if (status === ApiTransactionStatusEnum.Expired) {
      // if transaction attempts is > 3, move to DLQ and notify team
      await ActiveSessions.updatePaidSessionsWorkflowStatusesByTxId(txId, WorkflowStatus.EXPIRED);
    }
  });

  await StateData.unlockCron('mintConfirmLock');
  Logger.log(getLogMessage(startTime, paidSessions.length));

  return res.status(200).json({
    error: false,
    message: 'success'
  });
};
