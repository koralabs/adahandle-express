import * as express from "express";

import { MAX_CHAIN_LOAD } from "../../../helpers/constants";
import { AccessQueues } from '../../../models/firestore/collections/AccessQueues';
import { LogCategory, Logger } from "../../../helpers/Logger";
import { CronJobLockName, StateData } from "../../../models/firestore/collections/StateData";

const CRON_JOB_LOCK_NAME = CronJobLockName.SEND_AUTH_CODES_LOCK;

/**
 * Sends an authentication code to users in the next
 * batch, drawing from the queue.
 */
export const sendAuthCodesHandler = async (req: express.Request, res: express.Response) => {
  const stateData = await StateData.getStateData();
  if (stateData[CRON_JOB_LOCK_NAME]) {
    Logger.log({ message: `Cron job ${CRON_JOB_LOCK_NAME} is locked`, event: 'sendAuthCodesHandler.locked', category: LogCategory.NOTIFY });
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
    Logger.log('updating access queue');
    await AccessQueues.updateAccessQueue();
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
