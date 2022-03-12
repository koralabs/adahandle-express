import { WalletAddresses } from "../../models/firestore/collections/WalletAddresses";
import { WalletAddress } from "../../models/WalletAddress";

interface RTDWallet {
    derivation_path: string[],
    id: string,
    state: string
}

export const addWalletsToFirebase = async (wallets: RTDWallet[], startAtBatch = 0, walletAddressCollectionName: string) => {
    const walletAddresses: WalletAddress[] = wallets.map(wallet => {
        return new WalletAddress(wallet.id, 0);
    });

    console.log(`importing to collection ${walletAddressCollectionName}`);
    await WalletAddresses.batchAddWalletAddresses(walletAddresses, startAtBatch, walletAddressCollectionName);
}