import { Firebase } from "../helpers/firebase";
import { WalletAddresses } from "../models/firestore/collections/WalletAddresses";

const run = async () => {
    try {
        await Firebase.init();

        const promises = Array.from({ length: 10 }, () => WalletAddresses.getFirstAvailableWalletAddress());
        const wallets = await Promise.all(promises);

        console.log('wallets', wallets);
        const uniqueWalletIds = [...new Set(wallets.map(w => w?.id).filter(Boolean) as string[])];

        if (wallets.length !== uniqueWalletIds.length) {
            console.log('duplicates found');
            process.exit(1);
        }

        console.log('no duplicates found');

        process.exit();
    } catch (error) {
        console.log('ERROR', error);
        process.exit(1);
    }
}

run();