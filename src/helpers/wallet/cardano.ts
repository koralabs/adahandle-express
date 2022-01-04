import * as wallet from "cardano-wallet-js";
import { getMintingWalletId, getWalletEndpoint } from "../constants";

export const getWalletServer = () => {
    return wallet.WalletServer.init(
        getWalletEndpoint()
    );
}

export const getMintWalletServer = async (): Promise<wallet.ShelleyWallet> => {
    const walletServer = getWalletServer();
    return walletServer.getShelleyWallet(getMintingWalletId());
}
