import * as express from "express";
import { getChainLoad, getTotalHandles } from "../../helpers/cardano";
import { AccessQueues } from "../../models/firestore/collections/AccessQueues";
import { StateData } from "../../models/firestore/collections/StateData";
import { State } from "../../models/State";

interface StateResponseBody {
  error: boolean;
  message?: string;
  chainLoad?: number | null;
  position?: number;
  totalHandles?: number;
}

export const stateHandler = async (req: express.Request, res: express.Response) => {
  try {
    const numbers = await AccessQueues.getAccessQueues();
    const chainLoad = await getChainLoad() ?? 0;
    const position = numbers?.length || 0;
    const totalHandles = await getTotalHandles() || 0;

    const state = new State({ chainLoad, position, totalHandles });
    await StateData.upsertStateData(state);

    return res.status(200).json({
      error: false,
      chainLoad,
      position,
      totalHandles
    });
  } catch (e) {
    return res.status(500).json({
      error: true,
      message: e
    })
  }
}
