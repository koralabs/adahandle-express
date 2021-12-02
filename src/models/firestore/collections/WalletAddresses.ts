import * as admin from "firebase-admin";
import { asyncForEach, chunk, delay } from "../../../helpers/utils";
import { WalletAddress } from "../../WalletAddress";
import { buildCollectionNameWithSuffix } from "./lib/buildCollectionNameWithSuffix";
import { LogCategory, Logger } from "../../../helpers/Logger";

export class WalletAddresses {
    static readonly collectionName = buildCollectionNameWithSuffix('walletAddresses');

    static async getFirstAvailableWalletAddress(): Promise<WalletAddress | null> {
        // Since we can't have more than one user at a time use an address
        // we need to get the first one then delete it
        try {
            return admin.firestore().runTransaction(async (t) => {
                const snapshot = await t.get(admin.firestore().collection(WalletAddresses.collectionName).orderBy('id').limit(1));
                if (!snapshot.empty && snapshot.docs[0].exists) {
                    const doc = snapshot.docs[0];
                    const walletAddress = doc.data();
                    if (walletAddress) {
                        t.delete(doc.ref);
                        return walletAddress as WalletAddress;
                    }
                }

                return null;
            });
        } catch (e) {
            Logger.log({ category: LogCategory.ERROR, message: JSON.stringify(e) });
            throw new Error('Failed to get wallet address');
        }
    }

    static async batchAddWalletAddresses(walletAddresses: WalletAddress[], startAtBatch = 0): Promise<any> {
        const start = new Date().getTime();
        const db = admin.firestore();

        const walletAddressesChunks = chunk(walletAddresses, 500);
        const updatedWalletAddresses = startAtBatch !== 0 ? walletAddressesChunks.slice(startAtBatch) : walletAddressesChunks;

        await asyncForEach(updatedWalletAddresses, async (walletAddresses, index) => {
            const batch = db.batch();
            walletAddresses.forEach(address => {
                const collectionRef = db.collection(WalletAddresses.collectionName).doc(address.id);
                batch.create(collectionRef, address.toJSON());
            });

            await batch.commit();
            console.log(`Batch ${index} of ${updatedWalletAddresses.length} completed`);
            await delay(1000);
        });

        const end = new Date().getTime();
        const time = end - start;
        console.log(`Execution time: ${time}`);
    }
}
