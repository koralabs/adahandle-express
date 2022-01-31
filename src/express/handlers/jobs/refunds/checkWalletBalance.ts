import * as wallet from 'cardano-wallet-js';
import { LogCategory, Logger } from '../../../../helpers/Logger';

import { Refund } from "./processRefunds";

export const checkWalletBalance = async (refunds: Refund[], mintWallet: wallet.ShelleyWallet): Promise<void> => {
    const availableBalance = mintWallet.getAvailableBalance();

    const summedRefunds = refunds.reduce((acc, curr) => acc + curr.amount, 0);

    if (availableBalance < summedRefunds) {
        Logger.log({ message: `insufficient funds`, event: 'getRefundWallet.notEnoughFunds', category: LogCategory.NOTIFY });
        throw Error(`Balance of ${availableBalance} is not enough to refund ${summedRefunds}!`);
    }
}