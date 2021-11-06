import * as admin from "firebase-admin";
import { PaidSession } from "../../PaidSession";
import { buildCollectionNameWithSuffix } from "./lib/buildCollectionNameWithSuffix";

export class PaidSessions {
    public static readonly collectionName = buildCollectionNameWithSuffix('paidSessions');

    public static async getPaidSessions(): Promise<PaidSession[]> {
        const collection = await admin.firestore().collection(PaidSessions.collectionName).get();
        return collection.docs.map(doc => doc.data() as PaidSession);
    }

    static async removePaidSessionByWalletAddress({ address }: { address: string }): Promise<void> {
        try {
            await admin.firestore().runTransaction(async t => {
                const snapshot = await t.get(admin.firestore().collection(PaidSessions.collectionName));

                snapshot.docs.forEach(doc => {
                    const paidSession = doc.data() as PaidSession;
                    if (paidSession.wallet.address === address) {
                        t.delete(doc.ref);
                    }
                });
            });
        } catch (error) {
            console.log(error);
            throw new Error(`Unable to remove paid sessions for wallet ${address}`);
        }
    }

    static async addPaidSessions(paidSessions: PaidSession[]): Promise<FirebaseFirestore.WriteResult[]> {
        const db = admin.firestore();
        const batch = db.batch();

        // This can only handle 25 requests at a time. Do we need to chunk?
        paidSessions.forEach(session => {
            const collectionRef = db.collection(PaidSessions.collectionName).doc();
            batch.create(collectionRef, session.toJSON());
        });

        return await batch.commit();
    }

    static async removePaidSessions(paidSessions: PaidSession[]): Promise<void> {
        await admin.firestore().runTransaction(async t => {
            const snapshot = await t.get(admin.firestore().collection(PaidSessions.collectionName));
            snapshot.docs.forEach(doc => {
                const paidSession = doc.data() as PaidSession;
                if (paidSessions.find(p => p.wallet.address === paidSession.wallet.address)) {
                    t.delete(doc.ref);
                }
            });
        });
    }
}
