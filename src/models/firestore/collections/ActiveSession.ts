import * as admin from "firebase-admin";
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

  public static async removeActiveSessions(oldSessions: ActiveSession[]): Promise<admin.firestore.WriteResult[]> {
    const db = admin.firestore();
    const batch = db.batch();

    // This can only handle 25 requests at a time. Do we need to chunk?
    await Promise.all(
      oldSessions.slice(0, 25).map(async session => {
        const collectionQuery = db.collection(ActiveSessions.collectionName).where('wallet.address', '==', session.wallet.address).limit(1);
        const collectionRef = await collectionQuery.get().then(res => res.docs[0].ref);
        batch.delete(collectionRef);
      })
    );

    return await batch.commit();
  }
}
