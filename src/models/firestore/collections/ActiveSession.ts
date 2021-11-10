import * as admin from "firebase-admin";
import { asyncForEach, chunk, delay } from "../../../helpers/utils";
import { ActiveSession, ActiveSessionInput } from "../../ActiveSession";
import { buildCollectionNameWithSuffix } from "./lib/buildCollectionNameWithSuffix";

export class ActiveSessions {
  public static readonly collectionName = buildCollectionNameWithSuffix('activeSessions');

  public static async getActiveSessions(): Promise<ActiveSession[]> {
    const collection = await admin.firestore().collection(ActiveSessions.collectionName).get();
    return collection.docs.map(doc => new ActiveSession({
      ...doc.data() as ActiveSessionInput
    }));
  }

  public static async addActiveSessions(activeSessions: ActiveSession[]): Promise<void> {
    const db = admin.firestore();

    const activeSessionChunks = chunk(activeSessions, 500);
    await asyncForEach(activeSessionChunks, async (paidSessions, index) => {
      const batch = db.batch();
      activeSessions.forEach(session => {
        const docRef = db.collection(ActiveSessions.collectionName).doc();
        batch.create(docRef, session.toJSON());
      });

      await batch.commit();
      console.log(`Batch ${index} of ${activeSessionChunks.length} completed`);
      await delay(1000);
    });
  }

  public static async addActiveSession(newSession: ActiveSession): Promise<boolean> {
    return admin.firestore().runTransaction(async t => {
      const snapshot = await t.get(admin.firestore().collection(ActiveSessions.collectionName).where('handle', '==', newSession.handle).limit(1));
      if (!snapshot.empty) {
        return false;
      }

      t.create(admin.firestore().collection(ActiveSessions.collectionName).doc(), newSession.toJSON());
      return true;
    });
  }

  public static async removeActiveSession(session: ActiveSession, otherOperation: (t: admin.firestore.Transaction) => unknown): Promise<void> {
    return admin.firestore().runTransaction(async t => {
      const snapshot = await t.get(admin.firestore().collection(ActiveSessions.collectionName).where('wallet.address', '==', session.wallet.address).limit(1));
      if (snapshot.empty) {
        return;
      }

      otherOperation(t);
      t.delete(snapshot.docs[0].ref);
    });
  }

  public static async removeActiveSessions(oldSessions: ActiveSession[]): Promise<void> {
    const snapshot = await admin.firestore().collection(ActiveSessions.collectionName).get();
    if (snapshot.empty) {
      return;
    }

    Promise.all(
      snapshot.docs.filter(doc => oldSessions.some(oldSession => oldSession.wallet.address === doc.data()?.wallet?.address)).map(async doc => {
        return admin.firestore().runTransaction(async t => {
          const snapshot = await t.get(doc.ref);
          t.delete(snapshot.ref);
        });
      })
    );
  }
}
