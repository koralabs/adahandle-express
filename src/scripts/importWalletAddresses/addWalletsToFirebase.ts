import { WalletAddresses } from "../../models/firestore/collections/WalletAddresses";
import { WalletAddress } from "../../models/WalletAddress";

interface RTDWallet {
    derivation_path: string[],
    id: string,
    state: string
}

export const addWalletsToFirebase = async (wallets: RTDWallet[], startAtBatch = 0) => {
    const walletAddresses: WalletAddress[] = wallets.map(wallet => {
        return new WalletAddress(wallet.id);
    });

    await WalletAddresses.batchAddWalletAddresses(walletAddresses, startAtBatch);
}