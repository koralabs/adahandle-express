import {
  GraphqlCardanoPaymentAddress,
} from "../graphql";
import { getWalletServer, NewAddress } from "./cardano";
import { WalletAddresses } from "../../models/firestore/collections/WalletAddresses";
import { PaidSession } from "../../models/PaidSession";
import { Logger } from "../Logger";
import { buildTransactionFromPaidSessions } from "./minting";

export const getNewAddress = async (): Promise<NewAddress | false> => {
  const newAddress = await WalletAddresses.getFirstAvailableWalletAddress();

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
  const signedTransaction = await buildTransactionFromPaidSessions(sessions);
  const txId = await walletServer.submitTx(signedTransaction);
  return txId;
};
