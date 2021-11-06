import * as admin from "firebase-admin";
import { MintedHandle } from "../../MintedHandle";
import { buildCollectionNameWithSuffix } from "./lib/buildCollectionNameWithSuffix";

export class MintedHandles {
    public static readonly collectionName = buildCollectionNameWithSuffix('mintedHandles');

    static async getMintedHandles(): Promise<MintedHandle[]> {
        const collection = await admin.firestore().collection(MintedHandles.collectionName).get();
        return collection.docs.map(doc => doc.data() as MintedHandle);
    }

    static async addMintedHandle(handle: MintedHandle): Promise<void> {
        // should this be a transaction?
        await admin.firestore().collection(MintedHandles.collectionName).add(handle.toJSON());
    }
}