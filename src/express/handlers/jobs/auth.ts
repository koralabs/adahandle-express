import * as express from "express";

import { MAX_CHAIN_LOAD } from "../../../helpers/constants";
import { getChainLoad } from "../../../helpers/cardano";
import { AccessQueues } from '../../../models/firestore/collections/AccessQueues';
import { Logger } from "../../../helpers/Logger";

/**
 * Sends an authentication code to users in the next
 * batch, drawing from the queue.
 */
export const sendAuthCodesHandler = async (req: express.Request, res: express.Response) => {
  const chainLoad = await getChainLoad();

  // Don't send auth codes if chain load is too high.
  Logger.log({ message: `Current Chain Load: ${chainLoad}`, event: "sendAuthCodesHandler.getChainLoad" });
  if (!chainLoad || chainLoad > MAX_CHAIN_LOAD) {
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
