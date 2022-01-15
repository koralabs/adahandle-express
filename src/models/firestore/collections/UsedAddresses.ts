import * as admin from "firebase-admin";
import { UsedAddress, UsedAddressStatus } from "../../UsedAddress";

import { buildCollectionNameWithSuffix } from "./lib/buildCollectionNameWithSuffix";

export class UsedAddresses {
    public static readonly collectionName = buildCollectionNameWithSuffix('usedAddresses');

    static async getUsedAddressesUnsafe(): Promise<UsedAddress[]> {
        const collection = await admin.firestore().collection(UsedAddresses.collectionName).get();
        return collection.docs.map(doc => doc.data() as UsedAddress);
    }

    static async getRefundableAddresses(limit = 50): Promise<UsedAddress[]> {
        const snapshot = await admin.firestore()
            .collection(UsedAddresses.collectionName)
            .where('status', '==', UsedAddressStatus.PENDING)
            .where('dateAdded', '<', Date.now() - 1000 * 60 * 60 * 24)
            .limit(limit)
            .get();
        return snapshot.docs.map(doc => doc.data() as UsedAddress);
    }

    public static async addUsedAddress(address: string, dateAdded?: number): Promise<boolean> {
        await admin.firestore().collection(UsedAddresses.collectionName).doc(address).set(new UsedAddress(address, dateAdded).toJSON());
        return true;
    }

    public static async updateUsedAddressStatus(id: string, status: UsedAddressStatus): Promise<boolean> {
        await admin.firestore().collection(UsedAddresses.collectionName).doc(id).update({ status });
        return true;
    }

    /**
     * @param {string[]} paymentAddresses 
     * @param {Partial<UsedAddress>} partialUsedAddress Can be status, dateAdded, txId
     */
    public static async batchUpdateUsedAddresses(paymentAddresses: string[], partialUsedAddress: Partial<UsedAddress>) {
        if (partialUsedAddress.id) {
            throw new Error('Cannot update id');
        }

        const db = admin.firestore();
        const batch = db.batch();
        paymentAddresses.forEach(address => {
            const docRef = db.collection(UsedAddresses.collectionName).doc(address);
            batch.update(docRef, partialUsedAddress);
        });

        await batch.commit();
    }
}