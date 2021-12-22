import * as admin from "firebase-admin";
import { awaitForEach, chunk, delay } from "../../../helpers/utils";
import { RefundableSession } from "../../RefundableSession";
import { buildCollectionNameWithSuffix } from "./lib/buildCollectionNameWithSuffix";
import { LogCategory, Logger } from "../../../helpers/Logger";

export class RefundableSessions {
    public static readonly collectionName = buildCollectionNameWithSuffix('refundableSessions');

    static async getRefundableSessionsByLimit(limit: number): Promise<RefundableSession[]> {
        const collection = await admin.firestore()
          .collection(RefundableSessions.collectionName)
          .where('status', '==', 'pending')
          .limit(limit)
          .get();
        return collection.docs.map(doc => ({ ...doc.data(), id: doc.id } as RefundableSession));
    }

    static async updateRefundableSessions(sessions: RefundableSession[], txId: string, status: 'pending' | 'submitted' | 'confirmed'): Promise<boolean[]> {
      return Promise.all(sessions.map(async session => {
        return admin.firestore().runTransaction(async t => {
            const ref = admin.firestore().collection(RefundableSessions.collectionName).doc(session.id as string);
            t.update(ref, { txId, status });
            return true;
        }).catch(error => {
            console.log(error);
            Logger.log({ message: `error: ${JSON.stringify(error)} updating ${session.id}`, event: 'RefundableSessions.updateRefundableSessions.error', category: LogCategory.ERROR });
            return false;
        });
    }));
    }
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
        await awaitForEach(refundableSessionChunks, async (refundableSessionItems, index) => {
            const batch = db.batch();
            refundableSessionItems.forEach(session => {
                const docRef = db.collection(RefundableSessions.collectionName).doc();
                batch.create(docRef, session.toJSON());
            });

            await batch.commit();
            Logger.log(`Batch ${index} of ${refundableSessionChunks.length} completed`);
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
            Logger.log({ message: JSON.stringify(error), category: LogCategory.ERROR });
            throw new Error(`Unable to remove refundable sessions for wallet ${address}`);
        }
    }
}
