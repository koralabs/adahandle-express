import * as wallet from 'cardano-wallet-js';

import { UsedAddresses } from "../../../../models/firestore/collections/UsedAddresses";
import { UsedAddressStatus } from "../../../../models/UsedAddress";

export interface Refund { paymentAddress: string, returnAddress: string, amount: number }

export const processRefund = async (refund: Refund, refundWallet: wallet.ShelleyWallet) => {
    const { returnAddress, paymentAddress, amount } = refund;

    await UsedAddresses.updateUsedAddressStatus(paymentAddress, UsedAddressStatus.PROCESSING);

    const tx = await refundWallet.sendPayment(
        process.env.WALLET_PASSPHRASE,
        [new wallet.AddressWallet(returnAddress)],
        [amount]
    );

    if (tx.id) {
        await UsedAddresses.updateUsedAddressStatus(paymentAddress, UsedAddressStatus.PROCESSED);
    }
}