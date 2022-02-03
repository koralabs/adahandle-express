import * as wallet from 'cardano-wallet-js';
import { CoinSelectionWallet } from 'cardano-wallet-js/dist/wallet/coin-selection-wallet';
import { getMintingWalletSeedPhrase } from '../../../../helpers/constants';
import { getMintWalletServer, getWalletServer } from '../../../../helpers/wallet/cardano';
import { getNetworkConfig } from '../../../../helpers/wallet/minting';

import { UsedAddresses } from "../../../../models/firestore/collections/UsedAddresses";
import { UsedAddressStatus } from "../../../../models/UsedAddress";

export interface Refund { paymentAddress: string, returnAddress: string, amount: number }

export const processRefunds = async (refunds: Refund[], refundWallet: wallet.ShelleyWallet) => {
    const { paymentAddresses, returnAddresses, amounts } = refunds.reduce<{ paymentAddresses: string[], returnAddresses: wallet.AddressWallet[], amounts: number[] }>((acc, curr) => {
        const { paymentAddress, returnAddress, amount } = curr;
        acc.paymentAddresses.push(paymentAddress);
        acc.returnAddresses.push(new wallet.AddressWallet(returnAddress));
        acc.amounts.push(amount);
        return acc;
    }, { paymentAddresses: [], returnAddresses: [], amounts: [] });

    const usedAddressUpdates = paymentAddresses.map((paymentAddress) => ({ address: paymentAddress, props: { status: UsedAddressStatus.PROCESSING } }));
    await UsedAddresses.batchUpdateUsedAddresses(usedAddressUpdates);


    const networkConfig = getNetworkConfig();
    const walletServer = getWalletServer();
    const ourWallet = await getMintWalletServer(); // convert this to use the matching payment wallet

    const recoveryPhrase = getMintingWalletSeedPhrase();
    const rootKey = wallet.Seed.deriveRootKey(recoveryPhrase);

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
          quantity: amounts[index]
        },
        derivation_path: [
          "1852H"
        ],
        id: '', // should use returnAddresses[index].txHash
        index: 0 // should use returnAddresses[index].index
      };
    });

    returnAddresses.forEach((walletAddr, index) => {
      coinSelection.outputs[index] = {
        address: walletAddr.address,
        amount: {
          unit: wallet.WalletswalletIdpaymentfeesAmountUnitEnum.Lovelace,
          quantity: amounts[index],
        },
      };
    });

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

    // Ensure that we are submitting for payment wallet.
    const txId = await walletServer.submitTx(signed);

    // const tx = await refundWallet.sendPayment(
    //     process.env.WALLET_PASSPHRASE,
    //     returnAddresses,
    //     amounts
    // );

    if (txId) {
        const usedAddressUpdatesWithTxIds = paymentAddresses.map((paymentAddress) => ({ address: paymentAddress, props: { status: UsedAddressStatus.PROCESSED, txId: txId } }));
        await UsedAddresses.batchUpdateUsedAddresses(usedAddressUpdatesWithTxIds);
    }
}
