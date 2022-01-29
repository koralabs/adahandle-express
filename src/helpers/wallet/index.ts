import {
  GraphqlCardanoPaymentAddress,
} from "../graphql";
import { getWalletServer } from "./cardano";
import { WalletAddresses } from "../../models/firestore/collections/WalletAddresses";
import { Logger } from "../Logger";
import { buildTransactionFromPaidSessions } from "./minting";
import { CreatedBySystem } from "../constants";
import { ActiveSession } from "../../models/ActiveSession";

export const getNewAddress = async (createdBySystem?: CreatedBySystem): Promise<string | false> => {
  const newAddress = await WalletAddresses.getFirstAvailableWalletAddress(createdBySystem);

  if (!newAddress) {
    Logger.log("Not able to get new address.");
    return false;
  }

  return newAddress.id;
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

export const mintHandlesAndSend = async (sessions: ActiveSession[]): Promise<string> => {
  const walletServer = getWalletServer();
  const signedTransaction = await buildTransactionFromPaidSessions(sessions);
  const txId = await walletServer.submitTx(signedTransaction);
  return txId;
};
