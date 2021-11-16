import * as admin from "firebase-admin";
import { VerificationInstance } from "twilio/lib/rest/verify/v2/service/verification";
import { AUTH_CODE_EXPIRE, isTesting } from "../../../helpers/constants";
import { LogCategory, Logger } from "../../../helpers/Logger";
import { createTwilioVerification } from "../../../helpers/twilo";
import { AccessQueue } from "../../AccessQueue";
import { buildCollectionNameWithSuffix } from "./lib/buildCollectionNameWithSuffix";
import { StateData } from "./StateData";

export class AccessQueues {
  public static readonly collectionName = buildCollectionNameWithSuffix('accessQueues');
  public static readonly collectionNameDLQ = buildCollectionNameWithSuffix('accessQueuesDLQ');

  static async getAccessQueues(): Promise<AccessQueue[]> {
    const collection = await admin.firestore().collection(AccessQueues.collectionName).get();
    return collection.docs.map(doc => doc.data() as AccessQueue);
  }

  static async getAccessQueuesCount(): Promise<number> {
    const snapshot = await admin.firestore().collection(AccessQueues.collectionName).get();
    return snapshot.size;
  }

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

    const queuedSnapshot = await admin.firestore().collection(AccessQueues.collectionName).where('status', '==', 'queued').orderBy('dateAdded').limit(stateData.accessQueue_limit ?? 20).get();
    Logger.log({ message: `Queued Snapshot: ${queuedSnapshot.docs.length}`, event: 'updateAccessQueue.queuedSnapshot.length', category: LogCategory.METRIC });

    await Promise.all(queuedSnapshot.docs.map(async doc => {
      const entry = doc.data();

      let data: VerificationInstance | null = null;
      try {
        data = createVerificationFunction ? await createVerificationFunction(entry.phone) : await createTwilioVerification(entry.phone)
      } catch (e) {
        Logger.log({ message: `Error occurred verifying ${entry.phone}`, event: 'updateAccessQueue.createTwilioVerification.error', category: LogCategory.ERROR });
        Logger.log({ message: JSON.stringify(e), event: 'updateAccessQueue.createTwilioVerification.error', category: LogCategory.ERROR });

        // If Twilio throws an error, we are going to retry 2 more times
        // If we still fail, we will move the entry to the DLQ 
        await admin.firestore().runTransaction(async t => {
          const document = await t.get(doc.ref);
          const failedAccessQueue = document.data() as AccessQueue;

          // If there are more than 2 attempts, we need to add to a DLQ and remove the entry from the current queue
          if (failedAccessQueue.attempts >= 3) {
            Logger.log({ message: `Removing ${failedAccessQueue.phone} from queue and adding to DLQ`, event: 'updateAccessQueue.removeFromQueue.error' });
            t.create(admin.firestore().collection(AccessQueues.collectionNameDLQ).doc(), new AccessQueue({ ...failedAccessQueue }).toJSON());
            t.delete(document.ref);
            return;
          }

          // otherwise increment the retries
          t.update(document.ref, { attempts: admin.firestore.FieldValue.increment(1) });
        });

        return;
      }

      Logger.log({ message: `data: ${JSON.stringify(data)}`, event: 'updateAccessQueue.createTwilioVerification.data' });
      if (data) {
        await admin.firestore().runTransaction(async t => {
          const document = await t.get(doc.ref);
          t.update(document.ref, {
            phone: entry.phone,
            sid: data?.sid,
            status: data?.status,
            start: Date.now(),
          });
        });
      }
    }));

    /**
     * TODO: Send alert.
     * 1. Only if access queue size is > 3 hours wait.
     * 2. Send alert to the next 3 hours wait batch.
     */
    // const batchPhoneNumbers = getBatchPhoneNumbers();
    // await client.messages.create({
    //   messagingServiceSid: process.env.TWILIO_MESSAGING_SID as string,
    //   to: batchPhoneNumbers,
    //   body: 'Heads up! You\'re turn for ADA Handle access is coming up in the next few hours. We\'ll send you an access code when it\'s your turn. You will have 10 MINUTES to use it, so don\'t wait around!'
    // });

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

        // TODO: pretty sure we need to add the notification here...

        t.create(admin.firestore().collection(AccessQueues.collectionName).doc(), new AccessQueue({ phone }).toJSON());
        return {
          updated: true,
          alreadyExists: false
        };
      });
    } catch (error) {
      console.log('EERROROR', error);
      Logger.log({ message: JSON.stringify(error), event: 'addToQueue.error', category: LogCategory.ERROR });
      throw new Error(`Unable to add ${phone} to queue`);
    }
  }
}
