import * as express from "express";

import { MAX_CHAIN_LOAD } from "../../../helpers/constants";
import { AccessQueues } from '../../../models/firestore/collections/AccessQueues';
import { LogCategory, Logger } from "../../../helpers/Logger";
import { CronJobLockName, StateData } from "../../../models/firestore/collections/StateData";

/**
 * Sends an authentication code to users in the next
 * batch, drawing from the queue.
 */
export const sendAuthCodesHandler = async (req: express.Request, res: express.Response) => {
  const startTime = Date.now();
  const getLogMessage = (startTime: number, recordCount: number) => ({ message: `sendAuthCodesHandler processed ${recordCount} records in ${Date.now() - startTime}ms`, event: 'sendAuthCodesHandler.run', count: recordCount, milliseconds: Date.now() - startTime, category: LogCategory.METRIC });
  const stateData = await StateData.getStateData();
  if (stateData[CronJobLockName.SEND_AUTH_CODES_LOCK]) {
    Logger.log({ message: `Cron job ${CronJobLockName.SEND_AUTH_CODES_LOCK} is locked`, event: 'sendAuthCodesHandler.locked', category: LogCategory.NOTIFY });
    return res.status(200).json({
      error: false,
      message: 'Send auth codes cron is locked. Try again later.'
    });
  }

  // Don't send auth codes if chain load is too high.
  Logger.log({ message: `Current Chain Load: ${stateData?.chainLoad}`, event: "sendAuthCodesHandler.getChainLoad" });
  if (stateData?.chainLoad > MAX_CHAIN_LOAD) {
    return res.status(200).json({
      error: false,
      message: 'Chain load is too high.'
    });
  }

  // Update queue.
  try {
    const recordCount = await AccessQueues.updateAccessQueue();
    Logger.log(getLogMessage(startTime, recordCount.count));
    return res.status(200).json({
      error: false,
      message: 'Job complete.'
    });
  } catch (e) {
    return res.status(500).json({
      error: true,
      message: e
    })
  }
};
