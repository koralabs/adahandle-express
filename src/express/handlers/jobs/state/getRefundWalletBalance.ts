import { getRefundWalletId } from "../../../../helpers/constants";
import { LogCategory, Logger } from "../../../../helpers/Logger";
import { getMintWalletServer } from "../../../../helpers/wallet/cardano";

export const getRefundWalletBalance = async (): Promise<number> => {
    try {
        const walletId = getRefundWalletId();
        const refundWallet = await getMintWalletServer(walletId);
        return refundWallet.getAvailableBalance();
    } catch (error) {
        Logger.log({ message: JSON.stringify(error), event: 'getRefundWalletBalance.getAvailableBalance', category: LogCategory.ERROR });
        return 0;
    }
}