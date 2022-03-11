import * as wallet from "cardano-wallet-js";
import { getPaymentWalletId, getWalletEndpoint } from "../constants";

export const getWalletServer = () => {
    return wallet.WalletServer.init(
        getWalletEndpoint()
    );
}

export const getMintWalletServer = async (mintingWalletId: string): Promise<wallet.ShelleyWallet> => {
    const walletServer = getWalletServer();
    return walletServer.getShelleyWallet(mintingWalletId);
}

export const getPaymentWalletServer = async (): Promise<wallet.ShelleyWallet> => {
    const walletServer = getWalletServer();
    return walletServer.getShelleyWallet(getPaymentWalletId());
}
