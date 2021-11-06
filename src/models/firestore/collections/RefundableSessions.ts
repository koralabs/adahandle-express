import * as admin from "firebase-admin";
import { RefundableSession } from "../../RefundableSession";
import { buildCollectionNameWithSuffix } from "./lib/buildCollectionNameWithSuffix";

export class RefundableSessions {
    public static readonly collectionName = buildCollectionNameWithSuffix('refundableSessions');

    static async getRefundableSessions(): Promise<RefundableSession[]> {
        const collection = await admin.firestore().collection(RefundableSessions.collectionName).get();
        return collection.docs.map(doc => doc.data() as RefundableSession);
    }

    static async addRefundableSessions(refundableSessions: RefundableSession[]): Promise<FirebaseFirestore.WriteResult[]> {
        const db = admin.firestore();
        const batch = db.batch();

        // This can only handle 25 requests at a time. Do we need to chunk?
        refundableSessions.forEach(session => {
            const collectionRef = db.collection(RefundableSessions.collectionName).doc();
            batch.create(collectionRef, session.toJSON());
        });

        return await batch.commit();
    }

    static async removeSessionByWalletAddress(address: string): Promise<void> {
        try {
            await admin.firestore().runTransaction(async t => {
                const snapshot = await t.get(admin.firestore().collection(RefundableSessions.collectionName));

                snapshot.docs.forEach(doc => {
                    const paidSession = doc.data() as RefundableSession;
                    if (paidSession.wallet.address === address) {
                        t.delete(doc.ref);
                    }
                });
            });
        } catch (error) {
            console.log(error);
            throw new Error(`Unable to remove paid sessions for wallet address ${address}`);
        }
    }
}
