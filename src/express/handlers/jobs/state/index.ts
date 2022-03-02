import * as express from "express";
import { getChainLoad, getTotalHandles } from "../../../../helpers/cardano";
import { AccessQueues } from "../../../../models/firestore/collections/AccessQueues";
import { ActiveSessions } from "../../../../models/firestore/collections/ActiveSession";
import { StateData } from "../../../../models/firestore/collections/StateData";
import { State } from "../../../../models/State";
import { updateMintingWalletBalances } from "./updateMintingWalletBalances";
import { getHandlePrices } from "../../../../helpers/adausd"
import { WalletAddresses } from "../../../../models/firestore/collections/WalletAddresses";
import { LogCategory, Logger } from "../../../../helpers/Logger";
import { SettingsRepo } from "../../../../models/firestore/collections/SettingsRepo";

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
    Logger.log("SettingsCron started");
    const settings = await SettingsRepo.getSettings();
    const accessQueueSize = await AccessQueues.getAccessQueueCount();
    const mintingQueueSize = (await ActiveSessions.getPaidPendingSessions({ limit: 20000 })).length;
    const chainLoad = await getChainLoad() ?? 0;
    const totalHandles = await getTotalHandles() || 0;
    Logger.log("Before handlePrices");
    const handlePrices = await getHandlePrices();
    Logger.log("After handlePrices");

    const state = new State({ chainLoad, accessQueueSize, mintingQueueSize, totalHandles, handlePrices });
    await StateData.upsertStateData(state);

    await updateMintingWalletBalances();

    const walletAddressIndex = await WalletAddresses.getLatestWalletAddressIndex(settings.walletAddressCollectionName);
    if (walletAddressIndex <= settings.minimumWalletAddressAmount) {
      Logger.log({ message: `Wallet address amount is lower than minimum amount`, event: 'stateHandler.minWalletAddressAmount', category: LogCategory.NOTIFY });
    }

    return res.status(200).json({
      error: false,
      chainLoad,
      accessQueueSize,
      mintingQueueSize,
      totalHandles,
      handlePrices
    } as StateResponseBody);
  } catch (e) {
    return res.status(500).json({
      error: true,
      message: e
    } as StateResponseBody)
  }
}
