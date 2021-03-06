import * as admin from 'firebase-admin';
import { LogCategory, Logger } from '../../../helpers/Logger';
import { awaitForEach, chunk, delay } from '../../../helpers/utils';
import { ActiveSession, ActiveSessionInput, Status, WorkflowStatus } from '../../ActiveSession';
import { buildCollectionNameWithSuffix } from './lib/buildCollectionNameWithSuffix';

export class ActiveSessions {
    public static readonly collectionName = buildCollectionNameWithSuffix('activeSessions');
    public static readonly collectionNameDLQ = buildCollectionNameWithSuffix('activeSessionsDLQ');

    public static async getPendingActiveSessions(): Promise<ActiveSession[]> {
        const collection = await admin
            .firestore()
            .collection(ActiveSessions.collectionName)
            .where('status', '==', Status.PENDING)
            .get();
        return collection.docs.map(
            (doc) =>
                new ActiveSession({
                    ...(doc.data() as ActiveSessionInput)
                })
        );
    }

    static async getPaidPendingSessions({ limit }: { limit: number }): Promise<ActiveSession[]> {
        return ActiveSessions.getByStatusAndWorkflow(Status.PAID, WorkflowStatus.PENDING, limit);
    }

    static async getPaidSubmittedSessions({ limit }: { limit: number }): Promise<ActiveSession[]> {
        return ActiveSessions.getByStatusAndWorkflow(Status.PAID, WorkflowStatus.SUBMITTED, limit);
    }

    public static async getActiveSessionByHandle(handle: string): Promise<ActiveSession | null> {
        const session = await admin
            .firestore()
            .collection(ActiveSessions.collectionName)
            .where('handle', '==', handle)
            .limit(1)
            .get();
        if (session.empty) {
            return null;
        }
        return { ...session.docs[0].data } as ActiveSession;
    }

    public static async getActiveSessionsByEmail(emailAddress: string): Promise<ActiveSession[]> {
        const collection = await admin
            .firestore()
            .collection(ActiveSessions.collectionName)
            .where('emailAddress', '==', emailAddress)
            .get();
        return collection.docs.map(
            (doc) =>
                new ActiveSession({
                    ...(doc.data() as ActiveSessionInput)
                })
        );
    }

    public static async getByPaymentAddress(address: string): Promise<ActiveSession | null> {
        const collection = await admin
            .firestore()
            .collection(ActiveSessions.collectionName)
            .where('paymentAddress', '==', address)
            .limit(1)
            .get();
        if (collection.empty) {
            return null;
        }

        return collection.docs[0].data() as ActiveSession;
    }

    static async getByStatus({ statusType, limit }: { statusType: Status; limit?: number }): Promise<ActiveSession[]> {
        let query = await admin.firestore().collection(ActiveSessions.collectionName).where('status', '==', statusType);
        if (limit) {
            query = query.limit(limit);
        }
        const collection = await query.get();
        return collection.docs.map(
            (doc) =>
                new ActiveSession({
                    ...(doc.data() as ActiveSessionInput)
                })
        );
    }

    static async getByStatusAndWorkflow(
        status: Status,
        workflowStatus: WorkflowStatus,
        limit: number
    ): Promise<ActiveSession[]> {
        let query = await admin
            .firestore()
            .collection(ActiveSessions.collectionName)
            .where('status', '==', status)
            .where('workflowStatus', '==', workflowStatus);
        if (limit) {
            query = query.limit(limit);
        }
        const collection = await query.orderBy('dateAdded').get();
        return collection.docs.map(
            (doc) =>
                new ActiveSession({
                    ...(doc.data() as ActiveSessionInput)
                })
        );
    }

    static async getByHandle(handle: string): Promise<ActiveSession[]> {
        const snapshot = await admin
            .firestore()
            .collection(ActiveSessions.collectionName)
            .where('handle', '==', handle)
            .get();

        if (snapshot.empty) {
            return [];
        }

        return snapshot.docs.map((doc) => doc.data() as ActiveSession);
    }

    public static async addActiveSession(newSession: ActiveSession): Promise<boolean> {
        return admin.firestore().runTransaction(async (t) => {
            const pendingSnapshot = await t.get(
                admin
                    .firestore()
                    .collection(ActiveSessions.collectionName)
                    .where('handle', '==', newSession.handle)
                    .where('status', '==', Status.PENDING)
                    .limit(1)
            );
            const paidSnapshot = await t.get(
                admin
                    .firestore()
                    .collection(ActiveSessions.collectionName)
                    .where('handle', '==', newSession.handle)
                    .where('status', '==', Status.PAID)
                    .limit(1)
            );
            if (pendingSnapshot.empty && paidSnapshot.empty) {
                const docRef = admin.firestore().collection(ActiveSessions.collectionName).doc();
                const newDoc = { ...newSession.toJSON(), id: docRef.id };
                t.create(docRef, newDoc);
                return true;
            }

            return false;
        });
    }

    static async updateSessions(sessions: ActiveSession[]): Promise<boolean[]> {
        const filteredSessions = sessions.reduce<ActiveSession[]>((acc, session) => {
            if (session.id) {
                acc.push(session);
            } else {
                Logger.log({
                    message: `session: ${session.paymentAddress} is missing id`,
                    event: 'ActiveSessions.updateSessions.missing_id',
                    category: LogCategory.ERROR
                });
            }
            return acc;
        }, []);

        return Promise.all(
            filteredSessions.map(async (session) => {
                return admin
                    .firestore()
                    .runTransaction(async (t) => {
                        const ref = admin
                            .firestore()
                            .collection(ActiveSessions.collectionName)
                            .doc(session.id as string);

                        // If paid/submitted update session
                        if (session.status === Status.PAID && session.workflowStatus === WorkflowStatus.SUBMITTED) {
                            t.update(ref, { ...session.toJSON() });
                            return true;
                        }

                        // If not paid/submitted, get existing session and if paid/submitted ignore
                        const snapshot = await t.get(ref);
                        const doc = snapshot.data() as ActiveSession;
                        if (doc.status === Status.PAID && doc.workflowStatus === WorkflowStatus.SUBMITTED) {
                            return true;
                        }

                        t.update(ref, { ...session.toJSON() });
                        return true;
                    })
                    .catch((error) => {
                        Logger.log({
                            message: `error: ${JSON.stringify(error)} updating ${session.id}`,
                            event: 'ActiveSessions.updateStatus.error',
                            category: LogCategory.ERROR
                        });
                        return false;
                    });
            })
        );
    }

    static setPendingWorkflowStatusToProcessing(sessions: ActiveSession[]): Promise<boolean[]> {
        const filteredSessions = sessions.reduce<ActiveSession[]>((acc, session) => {
            if (session.id) {
                acc.push(session);
            } else {
                Logger.log({
                    message: `session: ${session.paymentAddress} is missing id`,
                    event: 'ActiveSessions.setPendingWorkflowStatusToProcessing.missing_id',
                    category: LogCategory.ERROR
                });
            }
            return acc;
        }, []);

        return Promise.all(
            filteredSessions.map(async (session) => {
                return admin
                    .firestore()
                    .runTransaction(async (t) => {
                        const snapshot = await t.get(
                            admin
                                .firestore()
                                .collection(ActiveSessions.collectionName)
                                .where('id', '==', session.id)
                                .where('workflowStatus', '==', Status.PENDING)
                        );
                        if (snapshot.empty || snapshot.size > 1) {
                            return false;
                        }

                        t.update(snapshot.docs[0].ref, { workflowStatus: WorkflowStatus.PROCESSING });
                        return true;
                    })
                    .catch((error) => {
                        Logger.log({
                            message: `error: ${JSON.stringify(error)} updating ${session.id}`,
                            event: 'setPendingWorkflowStatusToProcessing.error',
                            category: LogCategory.ERROR
                        });
                        return false;
                    });
            })
        );
    }

    static updateWorkflowStatusAndTxIdForSessions(
        txId: string,
        walletId: string,
        sessions: ActiveSession[],
        workflowStatus: WorkflowStatus
    ): Promise<boolean[]> {
        const filteredSessions = sessions.reduce<ActiveSession[]>((acc, session) => {
            if (session.id) {
                acc.push(session);
            } else {
                Logger.log({
                    message: `session: ${session.paymentAddress} is missing id`,
                    event: 'ActiveSessions.updateSessions.missing_id',
                    category: LogCategory.ERROR
                });
            }
            return acc;
        }, []);

        return Promise.all(
            filteredSessions.map(async (session) => {
                return admin
                    .firestore()
                    .runTransaction(async (t) => {
                        const ref = admin
                            .firestore()
                            .collection(ActiveSessions.collectionName)
                            .doc(session.id as string);
                        t.update(ref, { workflowStatus, txId, walletId });
                        return true;
                    })
                    .catch((error) => {
                        Logger.log({
                            message: `error: ${JSON.stringify(error)} updating ${session.id}`,
                            event: 'updateSessionStatuses.error',
                            category: LogCategory.ERROR
                        });
                        return false;
                    });
            })
        );
    }

    public static async updatePaidSessionsWorkflowStatusesByTxId(
        txId: string,
        newWorkflowStatus: WorkflowStatus
    ): Promise<void> {
        return admin.firestore().runTransaction(async (t) => {
            const snapshot = await t.get(
                admin.firestore().collection(ActiveSessions.collectionName).where('txId', '==', txId)
            );
            if (snapshot.empty) {
                return;
            }

            snapshot.docs.forEach((doc) => {
                const session = doc.data() as ActiveSession;
                const { attempts = 0, status, workflowStatus } = session;
                if (status !== Status.PAID) {
                    return;
                }

                if (attempts >= 2 && workflowStatus == WorkflowStatus.PENDING) {
                    Logger.log({
                        message: `Removing paid session: ${doc.id} with ${txId} from queue and adding to DLQ`,
                        event: 'updateSessionStatusesByTxId.pendingAttemptsLimitReached'
                    });
                    t.update(doc.ref, { status: Status.DLQ });
                    return;
                }

                t.update(doc.ref, {
                    workflowStatus: newWorkflowStatus,
                    txId: txId,
                    attempts: admin.firestore.FieldValue.increment(1)
                });
                return;
            });
        });
    }

    public static async addActiveSessions(activeSessions: ActiveSession[]): Promise<void> {
        const db = admin.firestore();

        const activeSessionChunks = chunk(activeSessions, 500);
        await awaitForEach(activeSessionChunks, async (paidSessions, index) => {
            const batch = db.batch();
            activeSessions.forEach((session) => {
                const docRef = db.collection(ActiveSessions.collectionName).doc();
                const newDoc = { ...session.toJSON(), id: docRef.id };
                batch.create(docRef, newDoc);
            });

            await batch.commit();
            Logger.log(`Batch ${index + 1} of ${activeSessionChunks.length} completed`);
            await delay(1000);
        });
    }
}
