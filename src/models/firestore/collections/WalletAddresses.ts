import * as admin from "firebase-admin";
import { PAYMENT_ADDRESS_THRESHOLD } from "../../../helpers/constants";
import { asyncForEach, chunk, delay } from "../../../helpers/utils";
import { WalletAddress } from "../../WalletAddress";
import { buildCollectionNameWithSuffix } from "./lib/buildCollectionNameWithSuffix";

export class WalletAddresses {
    static readonly collectionName = buildCollectionNameWithSuffix('walletAddresses');

    // TODO: we dont need all these things to get an address. We simply need the next one
    static getCurrentWalletsRef() {
        return admin.firestore().collection(WalletAddresses.collectionName).orderBy('id');
    }

    static async getFirstAvailableWalletAddress(): Promise<WalletAddress | null> {
        // Since we can't have more than one user at a time use an address
        // we need to get the first one then delete it
        try {
            return admin.firestore().runTransaction(async (t) => {
                const snapshot = await t.get(WalletAddresses.getCurrentWalletsRef().limit(1));
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
        } catch (error) {
            console.error(error);
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

    static async isPaymentThresholdPassed(): Promise<boolean> {
        try {
            return admin.firestore().runTransaction(async (t) => {
                const doc = await t.get(WalletAddresses.getCurrentWalletsRef());
                const itemsLength = doc.docs.length;

                if (itemsLength < PAYMENT_ADDRESS_THRESHOLD) {
                    console.log(`The wallet snapshot was lower than the threshold: ${PAYMENT_ADDRESS_THRESHOLD}`);
                    console.log(`The current address count for wallet is ${itemsLength}`);
                    return true;
                }

                return false;
            });
        } catch (error) {
            console.error(error);
            throw new Error('Failed to get wallet addresses');
        }
    }
}