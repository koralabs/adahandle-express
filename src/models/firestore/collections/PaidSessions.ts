import * as admin from "firebase-admin";
import { asyncForEach, chunk, delay } from "../../../helpers/utils";
import { PaidSession } from "../../PaidSession";
import { buildCollectionNameWithSuffix } from "./lib/buildCollectionNameWithSuffix";

export class PaidSessions {
    public static readonly collectionName = buildCollectionNameWithSuffix('paidSessions');

    public static async getPaidSessions(): Promise<PaidSession[]> {
        const collection = await admin.firestore()
          .collection(PaidSessions.collectionName)
          .where('status', '!=', 'confirmed')
          .limit(10)
          .get();
        return collection.docs.map(doc => doc.data() as PaidSession);
    }

    // TODO: Add load test
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

    static async updatePaidSessionsStatus(paidSessions: PaidSession[], status: 'confirmed' | 'pending' | 'submitted') {
      try {
        await admin.firestore().runTransaction(async t => {
            const snapshot = await t.get(admin.firestore().collection(PaidSessions.collectionName)
              .where('wallet.address', 'in', paidSessions.map(session => session.wallet.address))
              .limit(paidSessions.length));

            if (snapshot.empty) {
                return;
            }

            snapshot.docs.forEach((doc) => {
              t.update(doc.ref, {
                status
              });
            })
          });
      } catch (error) {
          console.log(error);
          throw new Error(`Unable to update paid sessions for wallets ${JSON.stringify(paidSessions)}`);
      }
    }

    // TODO: Add load test
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

    static async removePaidSessions(paidSessions: PaidSession[]): Promise<void> {
        const snapshot = await admin.firestore().collection(PaidSessions.collectionName).get();
        if (snapshot.empty) {
            return;
        }

        await Promise.all(
            snapshot.docs.filter(doc => paidSessions.some(paidSession => paidSession.wallet.address === doc.data()?.wallet?.address)).map(async doc => {
                await admin.firestore().runTransaction(async t => {
                    const snapshot = await t.get(doc.ref);
                    t.delete(snapshot.ref);
                });
            })
        );
    }
}
