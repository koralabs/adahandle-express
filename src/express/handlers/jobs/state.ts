import * as express from "express";
import { getChainLoad, getTotalHandles } from "../../../helpers/cardano";
import { AccessQueues } from "../../../models/firestore/collections/AccessQueues";
import { PaidSessions } from "../../../models/firestore/collections/PaidSessions";
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
    const mintingQueueSize = await (await PaidSessions.getByStatus({statusType: "pending", limit: 20000 })).length;
    const chainLoad = await getChainLoad() ?? 0;
    const totalHandles = await getTotalHandles() || 0;

    const state = new State({ chainLoad, accessQueueSize, mintingQueueSize, totalHandles });
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
