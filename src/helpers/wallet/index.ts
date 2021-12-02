import * as wallet from "cardano-wallet-js";

import {
  getPolicyPrivateKey,
  getMintingWalletSeedPhrase,
  getPolicyId
} from "../constants";
import {
  GraphqlCardanoPaymentAddress,
  lookupReturnAddresses,
} from "../graphql";
import { getIPFSImage } from "../image";
import { getMintWalletServer, getWalletServer, NewAddress } from "./cardano";
import { WalletAddresses } from "../../models/firestore/collections/WalletAddresses";
import { ReservedHandles } from "../../models/firestore/collections/ReservedHandles";
import { PaidSession } from "../../models/PaidSession";
import { LogCategory, Logger } from "../Logger";
import { buildTransactionFromPaidSessions, generateMetadataFromPaidSessions, getAddressWalletsFromTransactions, getTransactionsFromPaidSessions } from "./minting";

export const getNewAddress = async (): Promise<NewAddress | false> => {
  const newAddress = await WalletAddresses.getFirstAvailableWalletAddress();

  Logger.log(JSON.stringify(newAddress));
  if (!newAddress) {
    Logger.log("Not able to get new address.");
    return false;
  }

  return {
    address: newAddress.id,
  };
};

export const getAmountsFromPaymentAddresses = (
  paymentAddresses: GraphqlCardanoPaymentAddress[]
): number[] => {
  const balances = paymentAddresses.map((addr) =>
    addr.summary.assetBalances.filter((bal) => "ada" === bal.asset.assetName)
  );

  const totalBalances = balances.map((bal) => parseInt(bal[0].quantity));

  return totalBalances;
};

export const mintHandlesAndSend = async (sessions: PaidSession[]): Promise<string | void> => {
  const walletServer = getWalletServer();

  try {
    const signedTransaction = await buildTransactionFromPaidSessions(sessions);
    const txId = await walletServer.submitTx(signedTransaction);
    return txId;
  } catch(e) {
    Logger.log({ message: JSON.stringify(e), event: 'mintHandleAndSend.submitTx' });
    throw new Error('Failed to submit transaction.');
  }
};
