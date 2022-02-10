import * as admin from "firebase-admin";
import { LogCategory, Logger } from "../../../helpers/Logger";
import { buildCollectionNameWithSuffix } from "./lib/buildCollectionNameWithSuffix";

export class MintingCache {
    public static readonly collectionName = buildCollectionNameWithSuffix('mintingCache');

    public static async addHandleToMintCache(handle: string, t?: admin.firestore.Transaction): Promise<boolean> {
        const handleMinted = await admin.firestore().collection(MintingCache.collectionName).doc(handle).get();
        if (handleMinted.exists) {
            Logger.log({ message: `Handle ${handle} already exists in minting cache`, event: 'mintingCache.addHandleToMintCache', category: LogCategory.INFO });
            return false;
        }

        const docRef = admin.firestore().collection(MintingCache.collectionName).doc(handle);
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
            Logger.log({ message: `Error adding Handle ${handle} to minting cache. Error: ${error}`, event: 'mintingCache.addHandleToMintCache', category: LogCategory.ERROR });
        }

        return false;
    }

    public static async removeHandlesFromMintCache(handles: string[]): Promise<void> {
        await Promise.all(handles.map(async handle => {
            return admin.firestore().runTransaction(async t => {
                const ref = admin.firestore().collection(MintingCache.collectionName).doc(handle);
                t.delete(ref);
            }).catch(error => {
                Logger.log({ message: `error: ${JSON.stringify(error)} deleting handles ${handles.join(',')}`, event: 'removeHandlesFromMintCache.error', category: LogCategory.ERROR });
            });
        }));
    }
}