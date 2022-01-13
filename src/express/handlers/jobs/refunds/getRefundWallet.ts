import * as wallet from 'cardano-wallet-js';
import { LogCategory, Logger } from '../../../../helpers/Logger';

import { getMintWalletServer } from "../../../../helpers/wallet/cardano";
import { Refund } from "./processRefund";

export const getRefundWallet = async (refunds: Refund[]): Promise<wallet.ShelleyWallet> => {
    const refundWallet = await getMintWalletServer();
    const availableBalance = refundWallet.getTotalBalance();

    const summedRefunds = refunds.reduce((acc, curr) => acc + curr.amount, 0);
    if (availableBalance < summedRefunds) {
        Logger.log({ message: `insufficient funds`, event: 'getRefundWallet.notEnoughFunds', category: LogCategory.NOTIFY });
        throw Error(`Balance of ${availableBalance} is not enough to refund ${summedRefunds}!`);
    }

    return refundWallet;
}