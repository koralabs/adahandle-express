import * as admin from "firebase-admin";
import { CreatedBySystem } from "../../../helpers/constants";
import { UsedAddress, UsedAddressStatus } from "../../UsedAddress";

import { buildCollectionNameWithSuffix } from "./lib/buildCollectionNameWithSuffix";

export interface UsedAddressUpdates {
    address: string;
    props: Partial<UsedAddress>
}

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

    public static async addUsedAddress({ address, dateAdded, createdBySystem }: { address: string, dateAdded?: number, createdBySystem?: CreatedBySystem }): Promise<boolean> {
        await admin.firestore().collection(UsedAddresses.collectionName).doc(address).set(new UsedAddress({ id: address, dateAdded, createdBySystem }).toJSON());
        return true;
    }

    public static async updateUsedAddressStatus(id: string, status: UsedAddressStatus): Promise<boolean> {
        await admin.firestore().collection(UsedAddresses.collectionName).doc(id).update({ status });
        return true;
    }

    /**
     * @param {UsedAddressUpdates[]} updates `props` Can be status, dateAdded, txId
     */
    public static async batchUpdateUsedAddresses(updates: UsedAddressUpdates[]): Promise<void> {
        if (updates.some(update => update.props.id)) {
            throw new Error('Cannot update id');
        }

        const db = admin.firestore();
        const batch = db.batch();
        updates.forEach(update => {
            const { address, props: partialUsedAddress } = update;
            const docRef = db.collection(UsedAddresses.collectionName).doc(address);
            batch.update(docRef, partialUsedAddress);
        });

        await batch.commit();
    }
}