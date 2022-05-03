import * as wallet from 'cardano-wallet-js';
import { WalletSimplifiedBalance } from '../../../../helpers/graphql';
import { LogCategory, Logger } from '../../../../helpers/Logger';

import { UsedAddresses } from "../../../../models/firestore/collections/UsedAddresses";
import { UsedAddressStatus } from "../../../../models/UsedAddress";

export interface Refund { paymentAddress: string, returnAddress: WalletSimplifiedBalance }

export const processRefunds = async (refunds: Refund[], refundWallet: wallet.ShelleyWallet): Promise<string> => {
  const { paymentAddresses, returnAddresses, amounts } = refunds.reduce<{ paymentAddresses: string[], returnAddresses: wallet.AddressWallet[], amounts: number[] }>((acc, curr) => {
    const { paymentAddress, returnAddress: { amount, address } } = curr;
    acc.paymentAddresses.push(paymentAddress);
    acc.returnAddresses.push(new wallet.AddressWallet(address));
    acc.amounts.push(amount);
    return acc;
  }, { paymentAddresses: [], returnAddresses: [], amounts: [] });

  const usedAddressUpdates = paymentAddresses.map((paymentAddress) => ({ address: paymentAddress, props: { status: UsedAddressStatus.PROCESSING } }));
  await UsedAddresses.batchUpdateUsedAddresses(usedAddressUpdates);

  const tx = await refundWallet.sendPayment(
    process.env.REFUND_WALLET_PASSWORD,
    returnAddresses,
    amounts
  );

  Logger.log(`Submitted with txId: ${tx.id}`);

  if (!tx.id) {
    Logger.log({ message: 'Transaction does not have a valid id', event: 'processRefunds.noTxId.error', category: LogCategory.ERROR });
    throw new Error('Transaction does not have a valid id');
  }

  const usedAddressUpdatesWithTxIds = paymentAddresses.map((paymentAddress) => ({ address: paymentAddress, props: { status: UsedAddressStatus.PROCESSED, txId: tx.id } }));
  await UsedAddresses.batchUpdateUsedAddresses(usedAddressUpdatesWithTxIds);
  return tx.id;
}