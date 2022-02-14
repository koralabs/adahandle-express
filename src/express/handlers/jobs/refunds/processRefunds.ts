import * as wallet from 'cardano-wallet-js';
import { CoinSelectionWallet } from 'cardano-wallet-js/dist/wallet/coin-selection-wallet';
import { getPaymentWalletSeedPhrase } from '../../../../helpers/constants';
import { WalletSimplifiedBalance } from '../../../../helpers/graphql';
import { getWalletServer } from '../../../../helpers/wallet/cardano';
import { getNetworkConfig } from '../../../../helpers/wallet/minting';

import { UsedAddresses } from "../../../../models/firestore/collections/UsedAddresses";
import { UsedAddressStatus } from "../../../../models/UsedAddress";

export interface Refund { paymentAddress: string, returnAddress: WalletSimplifiedBalance }

export const processRefunds = async (refunds: Refund[], testRefundTransactions?: (item: CoinSelectionWallet) => string) => {
  const { paymentAddresses, returnAddresses } = refunds.reduce<{ paymentAddresses: string[], returnAddresses: WalletSimplifiedBalance[]}>((acc, curr) => {
    const { paymentAddress, returnAddress } = curr;
    acc.paymentAddresses.push(paymentAddress);
    acc.returnAddresses.push(returnAddress);
    return acc;
  }, { paymentAddresses: [], returnAddresses: [] });

  const usedAddressUpdates = paymentAddresses.map((paymentAddress) => ({ address: paymentAddress, props: { status: UsedAddressStatus.PROCESSING } }));
  await UsedAddresses.batchUpdateUsedAddresses(usedAddressUpdates);

  const coinSelection: CoinSelectionWallet = {
    inputs: [],
    outputs: [],
    change: [],
  };

  paymentAddresses.forEach((addr, index) => {
    coinSelection.inputs[index] = {
      address: addr,
      amount: {
        unit: wallet.WalletswalletIdpaymentfeesAmountUnitEnum.Lovelace,
        quantity: returnAddresses[index].amount
      },
      derivation_path: [
        "1852H"
      ],
      id: returnAddresses[index].txHash,
      index: returnAddresses[index].index
    };
  });

  returnAddresses.forEach((walletAddr, index) => {
    coinSelection.outputs[index] = {
      address: walletAddr.address,
      amount: {
        unit: wallet.WalletswalletIdpaymentfeesAmountUnitEnum.Lovelace,
        quantity: returnAddresses[index].amount,
      },
    };
  });

  if (testRefundTransactions && process.env.NODE_ENV != 'test') {
    // This is a problem throw errors
    throw new Error("testRefundTransactions can only be a parameter if NODE_ENV is 'test'");
  }
  // If we're running tests, we don't actually want to hit wallets
  const txId = await (testRefundTransactions ? testRefundTransactions(coinSelection) : refundTransactions(coinSelection));

  if (txId) {
    const usedAddressUpdatesWithTxIds = paymentAddresses.map((paymentAddress) => ({ address: paymentAddress, props: { status: UsedAddressStatus.PROCESSED, txId: txId } }));
    await UsedAddresses.batchUpdateUsedAddresses(usedAddressUpdatesWithTxIds);
  }
}

const refundTransactions = async (coinSelection: CoinSelectionWallet) => {
  const networkConfig = getNetworkConfig();
  const walletServer = getWalletServer();

  const recoveryPhrase = getPaymentWalletSeedPhrase();
  const rootKey = wallet.Seed.deriveRootKey(recoveryPhrase);

  const signingKeys = coinSelection.inputs.map((i) => {
    return wallet.Seed.deriveKey(rootKey, i.derivation_path || []).to_raw_key();
  });

  // Time to live.
  const info = await walletServer.getNetworkInformation();
  const ttl = info.node_tip.absolute_slot_number + 12000;
  let txBody = wallet.Seed.buildTransaction(coinSelection, ttl, { config: networkConfig });

  // Sign the tx so we can get the real transaction fee.
  let tx = wallet.Seed.sign(txBody, signingKeys);

  // Ensure that the real tx fee is updated on change output.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const txFee = parseInt(wallet.Seed.getTransactionFee(tx, networkConfig).to_str());

  coinSelection.outputs[0].amount.quantity -= txFee;

  // Rebuild and sign.
  txBody = wallet.Seed.buildTransaction(coinSelection, ttl, { config: networkConfig });
  tx = wallet.Seed.sign(txBody, signingKeys);
  const signed = Buffer.from(tx.to_bytes()).toString("hex");

  return await walletServer.submitTx(signed);

}