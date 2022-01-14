import * as wallet from 'cardano-wallet-js';

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

    await UsedAddresses.batchUpdateUsedAddresses(paymentAddresses, { status: UsedAddressStatus.PROCESSING });

    const tx = await refundWallet.sendPayment(
        process.env.WALLET_PASSPHRASE,
        returnAddresses,
        amounts
    );

    if (tx.id) {
        await UsedAddresses.batchUpdateUsedAddresses(paymentAddresses, { status: UsedAddressStatus.PROCESSED, txId: tx.id });
    }
}