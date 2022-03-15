import * as admin from "firebase-admin";
import { LogCategory, Logger } from "../../../helpers/Logger";
import { buildCollectionNameWithSuffix } from "./lib/buildCollectionNameWithSuffix";

export class MintingCache {
    public static readonly collectionName = buildCollectionNameWithSuffix('mintingCache');
    public static getHandleWithBookends(handle: string): string {
        return `[${handle}]`;
    }

    public static async addHandleToMintCache(handle: string, t?: admin.firestore.Transaction): Promise<boolean> {
        const handleWithBookends = this.getHandleWithBookends(handle);
        const handleMinted = await admin.firestore().collection(MintingCache.collectionName).doc(handleWithBookends).get();
        if (handleMinted.exists) {
            Logger.log({ message: `Handle ${handleWithBookends} already exists in minting cache`, event: 'mintingCache.addHandleToMintCache', category: LogCategory.INFO });
            return false;
        }

        const docRef = admin.firestore().collection(MintingCache.collectionName).doc(handleWithBookends);
        const newDoc = { id: docRef.id };
        try {
            if (t) {
                t.create(docRef, newDoc);
                return true;
            }

            return admin.firestore().runTransaction(async t => {
                t.create(docRef, newDoc);
                return true;
            });
        } catch (error) {
            Logger.log({ message: `Error adding Handle ${handleWithBookends} to minting cache. Error: ${error}`, event: 'mintingCache.addHandleToMintCache', category: LogCategory.ERROR });
        }

        return false;
    }

    public static async removeHandlesFromMintCache(handles: string[]): Promise<void> {
        await Promise.all(handles.map(async handle => {
            const handleWithBookends = this.getHandleWithBookends(handle);
            return admin.firestore().runTransaction(async t => {
                const ref = admin.firestore().collection(MintingCache.collectionName).doc(handleWithBookends);
                t.delete(ref);
            }).catch(error => {
                Logger.log({ message: `error: ${JSON.stringify(error)} deleting handles ${handles.join(',')}`, event: 'removeHandlesFromMintCache.error', category: LogCategory.ERROR });
            });
        }));
    }
}