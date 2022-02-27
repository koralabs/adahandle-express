import * as admin from "firebase-admin";

import { Firebase } from "../helpers/firebase";
import { awaitForEach, chunk, delay } from "../helpers/utils";
import { WalletAddresses } from "../models/firestore/collections/WalletAddresses"
import { WalletAddress } from "../models/WalletAddress";

const batchUpdateWalletAddresses = async (walletAddresses: WalletAddress[]) => {
    const start = new Date().getTime();
    const db = admin.firestore();

    const walletAddressesChunks = chunk(walletAddresses, 500);

    let i = 0

    await awaitForEach(walletAddressesChunks, async (walletAddresses, index) => {
        const batch = db.batch();
        walletAddresses.forEach(address => {
            i++;
            console.log(`index ${i} for ${address.id}`);
            const collectionRef = db.collection(WalletAddresses.collectionName).doc(address.id);
            batch.update(collectionRef, { index: i });
        });

        await batch.commit();
        console.log(`Batch ${index} of ${walletAddressesChunks.length} completed`);
        await delay(1000);
    });

    const end = new Date().getTime();
    const time = end - start;
    console.log(`Execution time: ${time}`);
}

const run = async () => {
    await Firebase.init();
    console.log('Fetching wallet addresses');
    const walletAddresses = await WalletAddresses.getWalletAddressesUnsafe();
    console.log('walletAddresses', walletAddresses.length);

    await batchUpdateWalletAddresses(walletAddresses);
}

run()