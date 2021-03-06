import * as admin from "firebase-admin";

import { LogCategory, Logger } from "../../../helpers/Logger";
import { createVerificationEmail, VerificationInstance } from "../../../helpers/email";
import { AccessQueue } from "../../AccessQueue";
import { buildCollectionNameWithSuffix } from "./lib/buildCollectionNameWithSuffix";
import { StateData } from "./StateData";
import { SettingsRepo } from "./SettingsRepo";
import { asyncForEach } from "../../../helpers/utils";

export class AccessQueues {
  public static readonly collectionName = buildCollectionNameWithSuffix('accessQueues');
  public static readonly collectionNameDLQ = buildCollectionNameWithSuffix('accessQueuesDLQ');

  static async getAccessQueues(): Promise<AccessQueue[]> {
    const collection = await admin.firestore().collection(AccessQueues.collectionName).orderBy('dateAdded', "desc").get();
    return collection.docs.map(doc => doc.data() as AccessQueue);
  }
  static async getAccessQueueData(ref: string): Promise<AccessQueue> {
    const doc = await admin.firestore().collection(AccessQueues.collectionName).doc(ref).get();
    return doc?.data() as AccessQueue;
  }

  static async getAccessQueueCount(): Promise<number> {
    const snapshot = await admin.firestore().collection(AccessQueues.collectionName).where('status', '==', 'queued').get(); // Need to account for the people that haven't clicked their links yet
    return snapshot.size;
  }

  static async removeAccessQueueByEmail(email: string): Promise<boolean> {
    try {        
      const snapshot = await admin.firestore().collection(AccessQueues.collectionName).where('email', '==', email).get();
      return admin.firestore().runTransaction(async t => {
        if (snapshot.empty) {
          return false;
        }
        snapshot.docs.forEach(doc => {
          t.delete(doc.ref);
        });

        return true;
      });
    } catch (error) {
      Logger.log({ message: JSON.stringify(error), event: 'removeAccessQueueByEmail.error', category: LogCategory.ERROR });
      throw new Error(`Unable to remove queues for ${email}`);
    }
  }

  static async updateAccessQueue(createVerificationFunction?: (email: string) => Promise<VerificationInstance>): Promise<{ count: number }> {
    const stateData = await StateData.getStateData();
    const settings = await SettingsRepo.getSettings();

    const queuedSnapshot = await admin.firestore().collection(AccessQueues.collectionName).where('status', '==', 'queued').orderBy('dateAdded').limit(settings.accessQueueLimit ?? 20).get();

    await asyncForEach(queuedSnapshot.docs, async (doc) => {
      const entry = doc.data();

      let data: VerificationInstance | null = null;
      try {
        data = createVerificationFunction ? await createVerificationFunction(entry.email) : await createVerificationEmail(entry.email, doc.ref.id)
      } catch (e) {
        Logger.log({ message: `Error occurred verifying ${entry.email}`, event: 'updateAccessQueue.createVerification.error', category: LogCategory.ERROR });
        Logger.log({ message: JSON.stringify(e), event: 'updateAccessQueue.createVerification.error', category: LogCategory.ERROR });

        // If Email server throws an error, we are going to retry 2 more times
        // If we still fail, we will move the entry to the DLQ
        await admin.firestore().runTransaction(async t => {
          const failedAccessQueue = doc.data() as AccessQueue;

          // If there are more than 2 attempts, we need to add to a DLQ and remove the entry from the current queue
          if (failedAccessQueue.attempts >= 10) {
            Logger.log({ message: `Removing ${failedAccessQueue.email} from queue and adding to DLQ`, event: 'updateAccessQueue.removeFromQueue.error' });
            t.create(admin.firestore().collection(AccessQueues.collectionNameDLQ).doc(), new AccessQueue({ ...failedAccessQueue }).toJSON());
            t.delete(doc.ref);
            return;
          }

          // otherwise increment the retries
          t.update(doc.ref, { attempts: admin.firestore.FieldValue.increment(1) });
        });

        return;
      }

      Logger.log({ message: `data: ${JSON.stringify(data)}`, event: 'updateAccessQueue.createVerification.data' });
      if (data) {
        await admin.firestore().runTransaction(async t => {
          t.update(doc.ref, {
            email: entry.email,
            authCode: data?.authCode,
            status: data?.status,
            start: Date.now(),
          });
        });
      }
    }, 5);

    if (queuedSnapshot.size > 0) {
      stateData.lastAccessTimestamp = Math.max(...queuedSnapshot.docs.map(doc => doc.data().dateAdded || 0));
      StateData.upsertStateData(stateData);
    }

    // delete expired entries
    const expired = await admin.firestore().collection(AccessQueues.collectionName)
      .where('start', '<', Date.now() - (settings.accessCodeTimeoutMinutes * 1000 * 60))
      .orderBy('start')
      .get();

    Logger.log({ message: `Expired: ${expired.docs.length}`, event: 'updateAccessQueue.access_queues.expired', count: expired.docs.length, category: LogCategory.METRIC });

    await Promise.all(expired.docs.map(async doc => {
      await admin.firestore().runTransaction(async t => {
        Logger.log(`deleting entry ${doc.id}`);
        t.delete(doc.ref);
      });
    }));

    return { count: queuedSnapshot.docs.length };
  }

  static async addToQueue({ email, clientAgentSha, clientIp }: { email: string; clientAgentSha: string; clientIp: string; }): Promise<{ updated: boolean; alreadyExists: boolean, dateAdded: number }> {
    try {
      return admin.firestore().runTransaction(async t => {
        const snapshot = await t.get(admin.firestore().collection(AccessQueues.collectionName).where('email', '==', email).limit(1));
        if (!snapshot.empty) {
          return {
            updated: false,
            alreadyExists: true,
            dateAdded: (snapshot.docs[0].data() as AccessQueue).dateAdded
          };
        }

        const accessQ = new AccessQueue({ email, clientAgentSha, clientIp });

        t.create(admin.firestore().collection(AccessQueues.collectionName).doc(), accessQ.toJSON());
        return {
          updated: true,
          alreadyExists: false,
          dateAdded: accessQ.dateAdded
        };
      });
    } catch (error) {
      Logger.log({ message: JSON.stringify(error), event: 'addToQueue.error', category: LogCategory.ERROR });
      throw new Error(`Unable to add ${email} to queue`);
    }
  }
}
