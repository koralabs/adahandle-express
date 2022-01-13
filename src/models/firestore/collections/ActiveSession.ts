import * as admin from "firebase-admin";
import { LogCategory, Logger } from "../../../helpers/Logger";
import { awaitForEach, chunk, delay } from "../../../helpers/utils";
import { ActiveSession, ActiveSessionInput } from "../../ActiveSession";
import { buildCollectionNameWithSuffix } from "./lib/buildCollectionNameWithSuffix";

export class ActiveSessions {
  public static readonly collectionName = buildCollectionNameWithSuffix('activeSessions');
  public static readonly collectionNameDLQ = buildCollectionNameWithSuffix('activeSessionsDLQ');

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

      const docRef = admin.firestore().collection(ActiveSessions.collectionName).doc();
      const newDoc = { ...newSession.toJSON(), id: docRef.id };
      t.create(docRef, newDoc);
      return true;
    });
  }

  public static async addActiveSessions(activeSessions: ActiveSession[]): Promise<void> {
    const db = admin.firestore();

    const activeSessionChunks = chunk(activeSessions, 500);
    await awaitForEach(activeSessionChunks, async (paidSessions, index) => {
      const batch = db.batch();
      activeSessions.forEach(session => {
        const docRef = db.collection(ActiveSessions.collectionName).doc();
        const newDoc = { ...session.toJSON(), id: docRef.id };
        batch.create(docRef, newDoc);
      });

      await batch.commit();
      Logger.log(`Batch ${index + 1} of ${activeSessionChunks.length} completed`);
      await delay(1000);
    });
  }

  public static async removeActiveSession<T>(session: ActiveSession, otherOperation?: (otherOperationArgs: T, t?: admin.firestore.Transaction) => Promise<void>, otherOperationArgs?: T): Promise<void> {
    if (!session.id) {
      Logger.log({ message: `No id found for session: ${JSON.stringify(session)}`, event: 'removeActiveSession.noId', category: LogCategory.ERROR });
      return;
    }

    return admin.firestore().runTransaction(async t => {
      const docRef = admin.firestore().collection(ActiveSessions.collectionName).doc(session.id as string);

      if (otherOperation && otherOperationArgs) {
        otherOperation(otherOperationArgs, t);
      }

      t.delete(docRef);
    });
  }

  public static async removeActiveSessions(oldSessions: ActiveSession[]): Promise<void> {
    await Promise.all(oldSessions.map(async session => {
      if (!session.id) {
        Logger.log({ message: `No id found for session: ${JSON.stringify(session)}`, event: 'removeActiveSessions.noId', category: LogCategory.ERROR });
        return;
      }

      return admin.firestore().runTransaction(async t => {
        const docRef = admin.firestore().collection(ActiveSessions.collectionName).doc(session.id as string);
        t.delete(docRef);
      }).catch(error => {
        Logger.log({ message: `error: ${JSON.stringify(error)} removing ${session.id}`, event: 'removeActiveSessions.error', category: LogCategory.ERROR });
      });
    }));
  }

  public static async removeAndAddToDLQ(activeSessions: ActiveSession[]): Promise<void> {
    await Promise.all(activeSessions.map(async session => {
      if (!session.id) {
        Logger.log({ message: `No id found for session: ${JSON.stringify(session)}`, event: 'activeSessions.removeAndAddToDLQ.noId', category: LogCategory.ERROR });
        return;
      }

      try {
        return admin.firestore().runTransaction(async (t) => {
          const ref = admin.firestore().collection(ActiveSessions.collectionName).doc(session.id as string);
          t.delete(ref);

          const dlqRef = admin.firestore().collection(ActiveSessions.collectionNameDLQ).doc();
          t.create(dlqRef, new ActiveSession({ ...session, id: dlqRef.id }).toJSON());
        });
      } catch (error) {
        Logger.log({ message: `error: ${JSON.stringify(error)} adding ${session.id} to DLQ`, event: 'activeSessions.removeAndAddToDLQ.error', category: LogCategory.ERROR });
      }
    }));
  }
}
