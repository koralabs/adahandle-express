import * as admin from "firebase-admin";
import { LogCategory, Logger } from "../../../helpers/Logger";
import { awaitForEach, chunk, delay } from "../../../helpers/utils";
import { ActiveSession, ActiveSessionInput, ActiveSessionStatus } from "../../ActiveSession";
import { buildCollectionNameWithSuffix } from "./lib/buildCollectionNameWithSuffix";

export class ActiveSessions {
  public static readonly collectionName = buildCollectionNameWithSuffix('activeSessions');
  public static readonly collectionNameDLQ = buildCollectionNameWithSuffix('activeSessionsDLQ');

  public static async getActiveSessions(): Promise<ActiveSession[]> {
    const collection = await admin.firestore().collection(ActiveSessions.collectionName).where('status', '==', ActiveSessionStatus.PENDING).get();
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


  public static async getByWalletAddress(address: string): Promise<ActiveSession | null> {
    const collection = await admin.firestore().collection(ActiveSessions.collectionName).where('paymentAddress', '==', address).limit(1).get();
    if (collection.empty) {
      return null;
    }

    return collection.docs[0].data() as ActiveSession;
  }

  static async getByStatus({ statusType, limit, }: { statusType: ActiveSessionStatus; limit: number; }): Promise<ActiveSession[]> {
    const collection = await admin.firestore().collection(ActiveSessions.collectionName).where('status', '==', statusType).limit(limit).get();
    return collection.docs.map(doc => new ActiveSession({
      ...doc.data() as ActiveSessionInput
    }));
  }

  static async getByHandle(handle: string): Promise<ActiveSession[]> {
    const snapshot = await admin.firestore()
      .collection(ActiveSessions.collectionName)
      .where('handle', '==', handle)
      .get();

    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs.map(doc => doc.data() as ActiveSession);
  }

  static async updateSessions(sessions: ActiveSession[]): Promise<boolean[]> {
    return Promise.all(sessions.map(async session => {
      return admin.firestore().runTransaction(async t => {
        const ref = admin.firestore().collection(ActiveSessions.collectionName).doc(session.id as string);
        t.update(ref, { ...session.toJSON() });
        return true;
      }).catch(error => {
        console.log(error);
        Logger.log({ message: `error: ${JSON.stringify(error)} updating ${session.id}`, event: 'ActiveSessions.updateStatus.error', category: LogCategory.ERROR });
        return false;
      });
    }));
  }

  static async updateStatusAndTxIdForSessions(txId: string, sanitizedSessions: ActiveSession[], statusType: ActiveSessionStatus): Promise<boolean[]> {
    return Promise.all(sanitizedSessions.map(async session => {
      return admin.firestore().runTransaction(async t => {
        const ref = admin.firestore().collection(ActiveSessions.collectionName).doc(session.id as string);
        t.update(ref, { status: statusType, txId });
        return true;
      }).catch(error => {
        Logger.log({ message: `error: ${JSON.stringify(error)} updating ${session.id}`, event: 'updateSessionStatuses.error', category: LogCategory.ERROR });
        return false;
      });
    }));
  }

  public static async updateSessionStatusesByTxId(txId: string, statusType: ActiveSessionStatus): Promise<void> {
    return admin.firestore().runTransaction(async t => {
      const snapshot = await t.get(admin.firestore().collection(ActiveSessions.collectionName).where('txId', '==', txId));
      if (snapshot.empty) {
        return;
      }

      snapshot.docs.forEach(doc => {
        if (statusType == ActiveSessionStatus.PAID_PENDING) {
          const session = doc.data() as ActiveSession;
          const { attempts = 0 } = session;
          if (attempts >= 2) {
            Logger.log({ message: `Removing paid session: ${doc.id} with ${txId} from queue and adding to DLQ`, event: 'updateSessionStatusesByTxId.pendingAttemptsLimitReached' });
            t.update(doc.ref, { status: ActiveSessionStatus.DLQ });
            return;
          }

          t.update(doc.ref, { status: statusType, txId: '', attempts: admin.firestore.FieldValue.increment(1) });
          return;
        }

        t.update(doc.ref, { status: statusType });
      });
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
}
