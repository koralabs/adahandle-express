import * as admin from "firebase-admin";
import { Logger } from "../../../helpers/Logger";
import { getBech32StakeKeyFromAddress } from "../../../helpers/serialization";
import { awaitForEach, chunk, delay } from "../../../helpers/utils";
import { StakePool } from "../../StakePool";
import { buildCollectionNameWithSuffix } from "./lib/buildCollectionNameWithSuffix";

export class StakePools {
    public static readonly collectionName = buildCollectionNameWithSuffix('stakePools');

    public static async addStakePool(pool: StakePool): Promise<boolean> {
        await admin.firestore().collection(StakePools.collectionName).doc(pool.id).set(pool.toJSON());
        return true;
    }

    public static async getStakePoolsByTicker(handle: string): Promise<StakePool[]> {
        const uppercaseHandle = handle.toUpperCase();
        const snapshot = await admin.firestore().collection(StakePools.collectionName).where('ticker', '==', uppercaseHandle).get();
        if (snapshot.empty) {
            return [];
        }

        return snapshot.docs.map(doc => doc.data() as StakePool);
    }

    public static async verifyReturnAddressOwnsStakePool(returnAddress: string, handle: string): Promise<boolean> {
        const stakeKey = getBech32StakeKeyFromAddress(returnAddress);
        const [stakePool] = await StakePools.getStakePoolsByTicker(handle);

        return stakePool?.stakeKey === stakeKey;
    }

    public static async batchAddStakePools(stakePoolsToAdd: StakePool[]): Promise<void> {
        const start = new Date().getTime();
        const db = admin.firestore();

        const stakePoolChunks = chunk(stakePoolsToAdd, 500);

        await awaitForEach(stakePoolChunks, async (stakePools, index) => {
            const batch = db.batch();
            stakePools.forEach(stakePool => {
                const collectionRef = db.collection(StakePools.collectionName).doc(stakePool.id);
                batch.create(collectionRef, stakePool.toJSON());
            });

            await batch.commit();
            Logger.log(`Batch ${index} of ${stakePoolChunks.length} completed`);
            await delay(1000);
        });

        const end = new Date().getTime();
        const time = end - start;
        Logger.log(`Execution time: ${time}`);
    }
}