import * as wallet from 'cardano-wallet-js';

import { PaidSession } from "../../models/PaidSession";
import { GraphqlCardanoSenderAddress, lookupReturnAddresses } from "../graphql";
import { LogCategory, Logger } from '../Logger';

export const getTransactionsFromPaidSessions = async (sessions: PaidSession[]): Promise<GraphqlCardanoSenderAddress[]> => {
  const transactions = await lookupReturnAddresses(sessions.map(session => session.wallet.address));
  if (!transactions || transactions.length < 1) {
    throw new Error(
      'Unable to find transactions.'
    );
  }

  return transactions;
}

export const getAddressWalletsFromTransactions = async (txs: GraphqlCardanoSenderAddress[]): Promise<wallet.AddressWallet[]> => {
  return txs.map((tx, index) => {
    const inputAddress = tx.inputs[0]?.address;

    if (!inputAddress) {
      Logger.log({ message: `No input address found at index ${index} from ${JSON.stringify(txs)}`, event: 'getAddressWalletsFromTransactions', category: LogCategory.ERROR });
      throw new Error(
        'No input address was found!'
      );
    }

    return new wallet.AddressWallet(inputAddress);
  });
}
