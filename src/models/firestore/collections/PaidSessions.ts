import * as admin from "firebase-admin";
import { LogCategory, Logger } from "../../../helpers/Logger";
import { asyncForEach, chunk, delay } from "../../../helpers/utils";
import { PaidSession, PaidSessionStatusType } from "../../PaidSession";
import { buildCollectionNameWithSuffix } from "./lib/buildCollectionNameWithSuffix";

export class PaidSessions {
    public static readonly collectionName = buildCollectionNameWithSuffix('paidSessions');
    public static readonly collectionNameDLQ = buildCollectionNameWithSuffix('paidSessionsDLQ');

    public static async getPaidSessionsUnsafe(): Promise<PaidSession[]> {
        const collection = await admin.firestore().collection(PaidSessions.collectionName).get();
        return collection.docs.map(doc => doc.data() as PaidSession);
    }

    static async removePaidSessionByWalletAddress({ address }: { address: string }): Promise<void> {
        try {
            await admin.firestore().runTransaction(async t => {
                const snapshot = await t.get(admin.firestore().collection(PaidSessions.collectionName).where('wallet.address', '==', address).limit(1));
                if (snapshot.empty) {
                    return;
                }

                t.delete(snapshot.docs[0].ref);
            });
        } catch (error) {
            console.log(error);
            throw new Error(`Unable to remove paid sessions for wallet ${address}`);
        }
    }


    static async addPaidSession(paidSession: PaidSession, t?: admin.firestore.Transaction) {
        const docRef = admin.firestore().collection(PaidSessions.collectionName).doc();
        if (t) {
            t.create(docRef, paidSession.toJSON());
            return;
        }

        await admin.firestore().runTransaction(async t => {
            t.create(docRef, paidSession.toJSON());
        });
    }

    static async addPaidSessions(paidSessions: PaidSession[]): Promise<void> {
        const db = admin.firestore();

        const paidSessionChunks = chunk(paidSessions, 500);
        await asyncForEach(paidSessionChunks, async (paidSessions, index) => {
            const batch = db.batch();
            paidSessions.forEach(session => {
                const docRef = db.collection(PaidSessions.collectionName).doc();
                batch.create(docRef, session.toJSON());
            });

            await batch.commit();
            console.log(`Batch ${index} of ${paidSessionChunks.length} completed`);
            await delay(1000);
        });
    }

    // TODO: test
    static async removeAndAddToDLQ(paidSessions: PaidSession[]): Promise<void> {
        await Promise.all(paidSessions.map(async session => {
            if (!session.id) {
                Logger.log({ message: `No id found for session: ${JSON.stringify(session)}`, event: 'removeAndAddToDLQ.noId', category: LogCategory.ERROR });
                return;
            }

            try {
                return admin.firestore().runTransaction(async (t) => {
                    const ref = admin.firestore().collection(PaidSessions.collectionName).doc(session.id as string);
                    t.delete(ref);

                    const dlqRef = admin.firestore().collection(PaidSessions.collectionNameDLQ).doc();
                    t.create(dlqRef, new PaidSession({ ...session, id: dlqRef.id }).toJSON());
                });
            } catch (error) {
                Logger.log({ message: `Unable to remove and add to DLQ ${session.id}`, event: 'removeAndAddToDLQ.error', category: LogCategory.ERROR });
            }
        }));
    }

    // TODO: test
    static async updateSessionStatuses(txId: string, sanitizedSessions: PaidSession[], statusType: PaidSessionStatusType): Promise<void> {
        await Promise.all(sanitizedSessions.map(session => {
            return admin.firestore().runTransaction(async t => {
                const snapshot = await t.get(admin.firestore().collection(PaidSessions.collectionName).where('wallet.address', '==', session.wallet.address).limit(1));
                if (snapshot.empty) {
                    return;
                }

                t.update(snapshot.docs[0].ref, { status: statusType, txId });
            });
        }));
    }


    static async updateSessionStatusesByTxId(txId: string, sessions: PaidSession[], statusType: PaidSessionStatusType) {
        return admin.firestore().runTransaction(async t => {
            const snapshot = await t.get(admin.firestore().collection(PaidSessions.collectionName).where('txId', '==', txId));
            if (snapshot.empty) {
                return;
            }

            snapshot.docs.forEach(doc => {
                if (statusType == 'pending') {
                    const session = doc.data() as PaidSession;

                    if (session?.attempts >= 3) {
                        t.delete(snapshot.docs[0].ref);
                        t.create(admin.firestore().collection(PaidSessions.collectionNameDLQ).doc(), new PaidSession({ ...session }).toJSON());
                        return;
                    }

                    t.update(doc.ref, { status: statusType, attempts: admin.firestore.FieldValue.increment(1) });
                    return;
                }
                t.update(doc.ref, { status: statusType });
            });
        });
    }

    static async getByStatus({ statusType, limit = 10 }: { statusType: PaidSessionStatusType, limit?: number }): Promise<PaidSession[]> {
        const snapshot = await admin.firestore()
            .collection(PaidSessions.collectionName)
            .where('status', '==', statusType)
            .limit(limit)
            .get();
        return snapshot.docs.map(doc => doc.data() as PaidSession);
    }
}
