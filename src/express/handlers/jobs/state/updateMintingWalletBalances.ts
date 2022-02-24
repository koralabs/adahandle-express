import { getMintingWallet } from "../../../../helpers/constants";
import { asyncForEach } from "../../../../helpers/utils";
import { getMintWalletServer } from "../../../../helpers/wallet/cardano";
import { StateData } from "../../../../models/firestore/collections/StateData";

export const updateMintingWalletBalances = async () => {
    const wallets = await StateData.getMintingWallets();
    await asyncForEach(wallets, async (wallet) => {
        const walletServer = await getMintWalletServer(getMintingWallet(wallet.index).walletId);
        await StateData.updateMintingWalletBalance(wallet.id, walletServer.getAvailableBalance());
    });
}