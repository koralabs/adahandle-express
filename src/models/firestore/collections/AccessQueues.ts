import * as admin from "firebase-admin";
import { VerificationInstance } from "twilio/lib/rest/verify/v2/service/verification";
import { AUTH_CODE_EXPIRE } from "../../../helpers/constants";
import { LogCategory, Logger } from "../../../helpers/Logger";
import { createTwilioVerification } from "../../../helpers/twilo";
import { AccessQueue } from "../../AccessQueue";
import { buildCollectionNameWithSuffix } from "./lib/buildCollectionNameWithSuffix";
import { StateData } from "./StateData";

interface AccessQueuePosition { updated: boolean; alreadyExists: boolean; position: number; dateAdded?: number, documentId?: string }

export class AccessQueues {
  public static readonly collectionName = buildCollectionNameWithSuffix('accessQueues');

  static async getAccessQueues(): Promise<AccessQueue[]> {
    const collection = await admin.firestore().collection(AccessQueues.collectionName).get();
    return collection.docs.map(doc => doc.data() as AccessQueue);
  }

  static async getAccessQueuesCount(): Promise<number> {
    const snapshot = await admin.firestore().collection(AccessQueues.collectionName).get();
    return snapshot.size;
  }

  // TODO: Add load test
  static async removeAccessQueueByPhone(phone: string): Promise<boolean> {
    try {
      return admin.firestore().runTransaction(async t => {
        const snapshot = await t.get(admin.firestore().collection(AccessQueues.collectionName).where('phone', '==', phone));
        if (snapshot.empty) {
          return false;
        }

        snapshot.docs.forEach(doc => {
          t.delete(doc.ref);
        });

        return true;
      });
    } catch (error) {
      Logger.log({ message: JSON.stringify(error), event: 'removeAccessQueueByPhone.error', category: LogCategory.ERROR });
      throw new Error(`Unable to remove queues for ${phone}`);
    }
  }

  static async updateAccessQueue(createVerificationFunction?: (phone: string) => Promise<VerificationInstance>): Promise<{ data: boolean }> {
    const stateData = await StateData.getStateData();

    let queuedSnapshot = await admin.firestore().collection(AccessQueues.collectionName).where('status', '==', 'queued').orderBy('dateAdded').limit(stateData.accessQueue_limit).get();;

    Logger.log({ message: `Queued Snapshot: ${queuedSnapshot.docs.length}`, event: 'updateAccessQueue.queuedSnapshot.length', category: LogCategory.METRIC });
    await Promise.all(queuedSnapshot.docs.map(async doc => {
      const entry = doc.data();

      const data = createVerificationFunction ? await createVerificationFunction(entry.phone) : await createTwilioVerification(entry.phone).catch(e => {
        // if Twilio throws an error, we should remove the entry from the queue?
        Logger.log({ message: JSON.stringify(e), event: 'updateAccessQueue.createTwilioVerification.error', category: LogCategory.ERROR });
      });

      Logger.log({ message: `data: ${JSON.stringify(data)}`, event: 'updateAccessQueue.createTwilioVerification.data' });
      if (data) {
        await admin.firestore().runTransaction(async t => {
          Logger.log(`updated entry ${doc.id}`);
          const document = await t.get(doc.ref);
          t.update(document.ref, {
            phone: entry.phone,
            sid: data.sid,
            status: data.status,
            start: Date.now(),
          });
        });
      }
    }));

    // delete expired entries
    const expired = await admin.firestore().collection(AccessQueues.collectionName)
      .where('start', '<', Date.now() - AUTH_CODE_EXPIRE)
      .orderBy('start')
      .get();

    Logger.log({ message: `Expired: ${expired.docs.length}`, event: 'updateAccessQueue.access_queues.expired.length', category: LogCategory.METRIC });

    await Promise.all(expired.docs.map(async doc => {
      await admin.firestore().runTransaction(async t => {
        Logger.log(`deleting entry ${doc.id}`);
        const document = await t.get(doc.ref);
        t.delete(document.ref);
      });
    }));

    return { data: true };
  }

  static async addToQueue(phone: string): Promise<{ updated: boolean; alreadyExists: boolean }> {
    try {
      return admin.firestore().runTransaction(async t => {
        const snapshot = await t.get(admin.firestore().collection(AccessQueues.collectionName).where('phone', '==', phone).limit(1));
        if (!snapshot.empty) {
          return {
            updated: false,
            alreadyExists: true
          };
        }

        t.create(admin.firestore().collection(AccessQueues.collectionName).doc(), new AccessQueue({ phone }).toJSON());
        return {
          updated: true,
          alreadyExists: false
        };
      });
    } catch (error) {
      Logger.log({ message: JSON.stringify(error), event: 'addToQueue.error', category: LogCategory.ERROR });
      throw new Error(`Unable to get details about queues for ${phone}`);
    }
  }
}
