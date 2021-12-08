import * as admin from "firebase-admin";
import { getCurrentSlotNumberFromTip } from '../../../helpers/graphql';
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

    static async getDLQPaidSessionsUnsafe(): Promise<PaidSession[]> {
        const collection = await admin.firestore().collection(PaidSessions.collectionNameDLQ).get();
        return collection.docs.map(doc => doc.data() as PaidSession);
    }

    static async getByStatus({ statusType, limit = 10 }: { statusType: PaidSessionStatusType, limit?: number }): Promise<PaidSession[]> {
        const snapshot = await admin.firestore()
            .collection(PaidSessions.collectionName)
            .where('status', '==', statusType)
            .orderBy('dateAdded')
            .limit(limit)
            .get();
        return snapshot.docs.map(doc => doc.data() as PaidSession);
    }

    static async getByHandles(handle: string): Promise<PaidSession[]> {
        const snapshot = await admin.firestore()
            .collection(PaidSessions.collectionName)
            .where('handle', '==', handle)
            .get();

        if (snapshot.empty) {
            return [];
        }

        return snapshot.docs.map(doc => doc.data() as PaidSession);
    }

    static async addPaidSession(paidSession: PaidSession, transaction?: admin.firestore.Transaction) {
        const docRef = admin.firestore().collection(PaidSessions.collectionName).doc();
        const newPaidSession = { ...paidSession.toJSON(), id: docRef.id };
        if (transaction) {
            transaction.create(docRef, newPaidSession);
            return;
        }

        await admin.firestore().runTransaction(async t => {
            t.create(docRef, newPaidSession);
        });
    }

    static async addPaidSessions(paidSessions: PaidSession[]): Promise<void> {
        const db = admin.firestore();

        const paidSessionChunks = chunk(paidSessions, 500);
        await asyncForEach(paidSessionChunks, async (paidSessions, index) => {
            const batch = db.batch();
            paidSessions.forEach(session => {
                const docRef = db.collection(PaidSessions.collectionName).doc();
                const newPaidSession = { ...session.toJSON(), id: docRef.id };
                batch.create(docRef, newPaidSession);
            });

            await batch.commit();
            Logger.log(`Batch ${index} of ${paidSessionChunks.length} completed`);
            await delay(1000);
        });
    }

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
                Logger.log({ message: `error: ${JSON.stringify(error)} adding ${session.id} to DLQ`, event: 'removeAndAddToDLQ.error', category: LogCategory.ERROR });
            }
        }));
    }

    static async updateSessionStatuses(txId: string, sanitizedSessions: PaidSession[], statusType: PaidSessionStatusType): Promise<boolean[]> {
        // const currentSlotNumber = await getCurrentSlotNumberFromTip();
        // console.log(currentSlotNumber);
        return Promise.all(sanitizedSessions.map(async session => {
            return admin.firestore().runTransaction(async t => {
                const ref = admin.firestore().collection(PaidSessions.collectionName).doc(session.id as string);
                t.update(ref, { status: statusType, txId });
                return true;
            }).catch(error => {
                Logger.log({ message: `error: ${JSON.stringify(error)} updating ${session.id}`, event: 'updateSessionStatuses.error', category: LogCategory.ERROR });
                return false;
            });
        }));
    }


    static async updateSessionStatusesByTxId(txId: string, statusType: PaidSessionStatusType) {
        return admin.firestore().runTransaction(async t => {
            const snapshot = await t.get(admin.firestore().collection(PaidSessions.collectionName).where('txId', '==', txId));
            if (snapshot.empty) {
                return;
            }

            snapshot.docs.forEach(doc => {
                if (statusType == 'pending') {
                    const session = doc.data() as PaidSession;

                    if (session?.attempts >= 2) {
                        Logger.log({ message: `Removing paid session: ${doc.id} with ${txId} from queue and adding to DLQ`, event: 'updateSessionStatusesByTxId.pendingAttemptsLimitReached' });
                        t.delete(snapshot.docs[0].ref);
                        t.create(admin.firestore().collection(PaidSessions.collectionNameDLQ).doc(), new PaidSession({ ...session }).toJSON());
                        return;
                    }

                    t.update(doc.ref, { status: statusType, txId: '', attempts: admin.firestore.FieldValue.increment(1) });
                    return;
                }
                t.update(doc.ref, { status: statusType });
            });
        });
    }
}
