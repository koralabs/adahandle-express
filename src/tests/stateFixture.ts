
import { CronState, State } from "../models/State";
import { Settings } from "../models/Settings";
import { StateData } from "../models/firestore/collections/StateData";
import { SettingsRepo } from "../models/firestore/collections/SettingsRepo";

export const state: State = new State({
  chainLoad: 0,
  accessQueueSize: 7000,
  mintingQueueSize: 3000,
  updateActiveSessionsLock: CronState.UNLOCKED,
  mintPaidSessionsLock: CronState.UNLOCKED,
  sendAuthCodesLock: CronState.UNLOCKED,
  saveStateLock: CronState.UNLOCKED,
  mintConfirmLock: CronState.UNLOCKED,
  lastMintingTimestamp: new Date().setMinutes(new Date().getMinutes() - 10), // 10 minutes ago,
  lastAccessTimestamp: 0,
  adaUsdQuoteHistory: [],
  lastQuoteTimestamp: 0
});

export const settings: Settings = new Settings({
  mintConfirmPaidSessionsLimit: 0,
  usedAddressesLimit: 0,
  accessCodeTimeoutMinutes: 0,
  accessWindowTimeoutMinutes: 0,
  chainLoadThresholdPercent: 0,
  ipfsRateDelay: 0,
  spoPageEnabled: false,
  walletAddressCollectionName: 'walletAddresses',
  minimumWalletAddressAmount: 10000,
  priceAdaUsdTest: 0,
  priceTestMode: 'OFF'
});

export const mintingWallet = {
  id: '1234',
  index: 1,
  locked: false,
  balance: 1000000000,
  minBalance: 100000000,
  updatedTimestamp: new Date(Date.now()).toISOString()
}

export const setupStateFixtures = () => {
  jest.mock('../models/firestore/collections/StateData');
  jest.spyOn(StateData, 'getStateData').mockResolvedValue(state);
  jest.spyOn(SettingsRepo, 'getSettings').mockResolvedValue(settings);
  jest.spyOn(StateData, 'unlockCron').mockImplementation();
  jest.spyOn(StateData, 'lockCron').mockImplementation();
  jest.spyOn(StateData, 'unlockMintingWallet').mockImplementation();
  jest.spyOn(StateData, 'findAvailableMintingWallet').mockResolvedValue(mintingWallet)
  jest.spyOn(StateData, 'upsertStateData').mockImplementation();
}