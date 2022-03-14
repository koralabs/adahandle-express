import * as admin from "firebase-admin";
import { awaitForEach, chunk, delay } from "../../../helpers/utils";
import { WalletAddress } from "../../WalletAddress";
import { buildCollectionNameWithSuffix } from "./lib/buildCollectionNameWithSuffix";
import { LogCategory, Logger } from "../../../helpers/Logger";
import { UsedAddresses } from "./UsedAddresses";
import { CreatedBySystem } from "../../../helpers/constants";

export class WalletAddresses {
    static readonly collectionName = buildCollectionNameWithSuffix('walletAddresses');

    private static getCollectionName(dynamoCollectionName?: string): string {
        return dynamoCollectionName ? buildCollectionNameWithSuffix(dynamoCollectionName) : WalletAddresses.collectionName
    }

    static async getWalletAddressesUnsafe(dynamoCollectionName?: string): Promise<WalletAddress[]> {
        const snapshot = await admin.firestore().collection(WalletAddresses.getCollectionName(dynamoCollectionName)).orderBy('index', 'desc').limit(0).get();
        return snapshot.docs.map(doc => doc.data() as WalletAddress);
    }

    static async getLatestWalletAddressIndex(dynamoCollectionName?: string): Promise<number> {
        const snapshot = await admin.firestore().collection(WalletAddresses.getCollectionName(dynamoCollectionName)).orderBy('index', 'desc').limit(1).get();
        return (snapshot.docs[0].data() as WalletAddress).index;
    }

    static async getFirstAvailableWalletAddress(createdBySystem?: CreatedBySystem, collection?: string): Promise<WalletAddress | null> {
        // Since we can't have more than one user at a time use an address
        // we need to get the first one then delete it
        const nameOfCollection = WalletAddresses.getCollectionName(collection);
        try {
            const snapshot = await admin.firestore().collection(nameOfCollection).orderBy('index', 'desc').limit(20).get();
            if (!snapshot.empty && snapshot.size == 20) {
                const randomIndex = Math.floor(Math.random() * 20);
                const doc = snapshot.docs[randomIndex];
                const walletAddress = doc.data();
                if (walletAddress) {
                    return admin.firestore().runTransaction(async (t) => {
                        try {
                            t.delete(doc.ref, { exists: true });
                            UsedAddresses.addUsedAddress({ address: walletAddress.id, createdBySystem });
                            return walletAddress as WalletAddress;
                        }
                        catch (e) {
                            Logger.log({ category: LogCategory.ERROR, message: JSON.stringify(e) });
                            throw e;
                        }
                    });
                }
            }
            return null;
        } catch (e) {
            throw new Error('Failed to get wallet address');
        }
    }

    static async batchAddWalletAddresses(walletAddresses: WalletAddress[], startAtBatch = 0, walletAddressCollectionName = WalletAddresses.collectionName): Promise<void> {
        const start = new Date().getTime();
        const db = admin.firestore();

        const walletAddressesChunks = chunk(walletAddresses, 500);
        const updatedWalletAddresses = startAtBatch !== 0 ? walletAddressesChunks.slice(startAtBatch) : walletAddressesChunks;

        let i = 0;

        await awaitForEach(updatedWalletAddresses, async (walletAddresses, index) => {
            const batch = db.batch();
            walletAddresses.forEach(address => {
                i++;
                console.log(`index ${i} for ${address.id}`);
                const collectionRef = db.collection(walletAddressCollectionName).doc(address.id);
                batch.create(collectionRef, { ...address.toJSON(), index: i });
            });

            await batch.commit();
            Logger.log(`Batch ${index} of ${updatedWalletAddresses.length} completed`);
            await delay(1000);
        });

        const end = new Date().getTime();
        const time = end - start;
        Logger.log(`Execution time: ${time}`);
    }
}
