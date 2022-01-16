import * as express from "express";

import { MAX_CHAIN_LOAD } from "../../../helpers/constants";
import { AccessQueues } from '../../../models/firestore/collections/AccessQueues';
import { LogCategory, Logger } from "../../../helpers/Logger";
import { StateData } from "../../../models/firestore/collections/StateData";

/**
 * Sends an authentication code to users in the next
 * batch, drawing from the queue.
 */
export const sendAuthCodesHandler = async (req: express.Request, res: express.Response) => {
  const startTime = Date.now();
  const state = await StateData.getStateData();
  const getLogMessage = (startTime: number, recordCount: number) => ({ message: `sendAuthCodesHandler processed ${recordCount} records in ${Date.now() - startTime}ms`, event: 'sendAuthCodesHandler.run', count: recordCount, milliseconds: Date.now() - startTime, category: LogCategory.METRIC });

  // Don't send auth codes if chain load is too high.
  Logger.log({ message: `Current Chain Load: ${state.chainLoad}`, event: "sendAuthCodesHandler.getChainLoad" });
  if (state.chainLoad > MAX_CHAIN_LOAD) {
    return res.status(200).json({
      error: false,
      message: 'Chain load is too high.'
    });
  }

  if (!await StateData.checkAndLockCron('sendAuthCodesLock')){
    return res.status(200).json({
      error: false,
      message: 'Send Auth Codes cron is locked. Try again later.'
    });
  }

  // Update queue.
  try {
    const recordCount = await AccessQueues.updateAccessQueue();
    await StateData.unlockCron('sendAuthCodesLock');
    Logger.log(getLogMessage(startTime, recordCount.count));
    return res.status(200).json({
      error: false,
      message: 'Job complete.'
    });
  } catch (e) {
    Logger.log({message: JSON.stringify(e), event: 'sendAuthCodesHandler.run', category: LogCategory.ERROR});
    await StateData.unlockCron('sendAuthCodesLock');
    return res.status(500).json({
      error: true,
      message: e
    })
  }
};
