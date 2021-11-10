import * as admin from "firebase-admin";
import { asyncForEach, chunk, delay } from "../../../helpers/utils";
import { RefundableSession } from "../../RefundableSession";
import { buildCollectionNameWithSuffix } from "./lib/buildCollectionNameWithSuffix";

export class RefundableSessions {
    public static readonly collectionName = buildCollectionNameWithSuffix('refundableSessions');

    static async getRefundableSessions(): Promise<RefundableSession[]> {
        const collection = await admin.firestore().collection(RefundableSessions.collectionName).get();
        return collection.docs.map(doc => doc.data() as RefundableSession);
    }
    static async addRefundableSession(refundableSession: RefundableSession, t?: admin.firestore.Transaction): Promise<void> {
        const docRef = admin.firestore().collection(RefundableSessions.collectionName).doc();
        if (t) {
            t.create(docRef, refundableSession.toJSON());
            return;
        }

        await admin.firestore().runTransaction(async t => {
            t.create(docRef, refundableSession.toJSON());
        });
    }

    static async addRefundableSessions(refundableSessions: RefundableSession[]): Promise<void> {
        const db = admin.firestore();

        const refundableSessionChunks = chunk(refundableSessions, 500);
        await asyncForEach(refundableSessionChunks, async (refundableSessionItems, index) => {
            const batch = db.batch();
            refundableSessionItems.forEach(session => {
                const docRef = db.collection(RefundableSessions.collectionName).doc();
                batch.create(docRef, session.toJSON());
            });

            await batch.commit();
            console.log(`Batch ${index} of ${refundableSessionChunks.length} completed`);
            await delay(1000);
        });
    }

    // TODO: Add load test
    static async removeSessionByWalletAddress(address: string): Promise<void> {
        try {
            await admin.firestore().runTransaction(async t => {
                const snapshot = await t.get(admin.firestore().collection(RefundableSessions.collectionName).where('wallet.address', '==', address).limit(1));
                if (snapshot.empty) {
                    return;
                }

                t.delete(snapshot.docs[0].ref);
            });
        } catch (error) {
            console.log(error);
            throw new Error(`Unable to remove refundable sessions for wallet ${address}`);
        }
    }
}
