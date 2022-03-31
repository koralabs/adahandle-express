import * as admin from "firebase-admin";
import { buildCollectionNameWithSuffix } from "./lib/buildCollectionNameWithSuffix";
import { PoolProof } from "../../PoolProof";

export class PoolProofs {
    public static readonly collectionName = buildCollectionNameWithSuffix('poolProofs');

    public static async addPoolProof({ poolId, vrfKey, vKeyHash, nonce }: { poolId: string, vrfKey: string, vKeyHash: string, nonce: string }): Promise<boolean> {
        await admin.firestore().collection(PoolProofs.collectionName).doc(poolId).set(new PoolProof({ poolId, vrfKey, vKeyHash, nonce }).toJSON());
        return true;
    }

    public static async updatePoolProof({ poolId, signature }: { poolId: string, signature: string }): Promise<boolean> {
        const ref = admin.firestore().collection(PoolProofs.collectionName).doc(poolId);
        await ref.update({ proof: signature, end: Date.now() });
        return true;
    }
}