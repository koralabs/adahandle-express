import * as express from "express";
import { getChainLoad, getTotalHandles } from "../../../helpers/cardano";
import { getHandlePrices } from "../../../helpers/adausd";
import { AccessQueues } from "../../../models/firestore/collections/AccessQueues";
import { ActiveSessions } from "../../../models/firestore/collections/ActiveSession";
import { StateData } from "../../../models/firestore/collections/StateData";
import { State } from "../../../models/State";

interface StateResponseBody {
  error: boolean;
  message?: string;
  chainLoad?: number | null;
  accessQueueSize?: number;
  mintingQueueSize?: number;
  totalHandles?: number;
}

export const stateHandler = async (req: express.Request, res: express.Response) => {
  try {
    const accessQueueSize = await AccessQueues.getAccessQueueCount();
    const mintingQueueSize = await (await ActiveSessions.getPaidPendingSessions({ limit: 20000 })).length;
    const chainLoad = await getChainLoad() ?? 0;
    const totalHandles = await getTotalHandles() || 0;
    const handlePrices = await getHandlePrices();

    const state = new State({ chainLoad, accessQueueSize, mintingQueueSize, totalHandles, handlePrices });
    await StateData.upsertStateData(state);

    return res.status(200).json({
      error: false,
      chainLoad,
      accessQueueSize,
      mintingQueueSize,
      totalHandles
    } as StateResponseBody);
  } catch (e) {
    return res.status(500).json({
      error: true,
      message: e
    } as StateResponseBody)
  }
}
