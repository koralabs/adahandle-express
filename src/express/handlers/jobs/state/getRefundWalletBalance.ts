import { getRefundWalletId } from "../../../../helpers/constants";
import { getMintWalletServer } from "../../../../helpers/wallet/cardano";

export const getRefundWalletBalance = async (): Promise<number> => {
    const walletId = getRefundWalletId();
    const refundWallet = await getMintWalletServer(walletId);
    return refundWallet.getAvailableBalance();
}