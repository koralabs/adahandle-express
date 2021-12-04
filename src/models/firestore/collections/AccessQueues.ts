import * as admin from "firebase-admin";
import { VerificationInstance } from "twilio/lib/rest/verify/v2/service/verification";
import * as sgMail from "@sendgrid/mail";

import { AUTH_CODE_EXPIRE } from "../../../helpers/constants";
import { LogCategory, Logger } from "../../../helpers/Logger";
import { createTwilioVerification } from "../../../helpers/twilo";
import { AccessQueue } from "../../AccessQueue";
import { buildCollectionNameWithSuffix } from "./lib/buildCollectionNameWithSuffix";
import { StateData } from "./StateData";
import { isTesting, isEmulating } from "../../../helpers/constants";

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

  static async removeAccessQueueByEmail(email: string): Promise<boolean> {
    try {
      return admin.firestore().runTransaction(async t => {
        const snapshot = await t.get(admin.firestore().collection(AccessQueues.collectionName).where('email', '==', email));
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

  static async updateAccessQueue(createVerificationFunction?: (email: string) => Promise<VerificationInstance>): Promise<{ data: boolean }> {
    const stateData = await StateData.getStateData();

    const queuedSnapshot = await admin.firestore().collection(AccessQueues.collectionName).where('status', '==', 'queued').orderBy('dateAdded').limit(stateData.accessQueue_limit ?? 20).get();
    Logger.log({ message: `Queued Snapshot: ${queuedSnapshot.docs.length}`, event: 'updateAccessQueue.queuedSnapshot', count: queuedSnapshot.docs.length, category: LogCategory.METRIC });

    await Promise.all(queuedSnapshot.docs.map(async doc => {
      const entry = doc.data();

      let data: VerificationInstance | null = null;
      try {
        data = createVerificationFunction ? await createVerificationFunction(entry.email) : await createTwilioVerification(entry.email)
      } catch (e) {
        Logger.log({ message: `Error occurred verifying ${entry.email}`, event: 'updateAccessQueue.createTwilioVerification.error', category: LogCategory.ERROR });
        Logger.log({ message: JSON.stringify(e), event: 'updateAccessQueue.createTwilioVerification.error', category: LogCategory.ERROR });

        // If Twilio throws an error, we are going to retry 2 more times
        // If we still fail, we will move the entry to the DLQ
        await admin.firestore().runTransaction(async t => {
          const document = await t.get(doc.ref);
          const failedAccessQueue = document.data() as AccessQueue;

          // If there are more than 2 attempts, we need to add to a DLQ and remove the entry from the current queue
          if (failedAccessQueue.attempts >= 3) {
            Logger.log({ message: `Removing ${failedAccessQueue.email} from queue and adding to DLQ`, event: 'updateAccessQueue.removeFromQueue.error' });
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
            email: entry.email,
            sid: data?.sid,
            status: data?.status,
            start: Date.now(),
          });
        });
      }
    }));

    // Alert the upcoming batch.
    await AccessQueues.alertBatchByEstimatedHours(3);

    // delete expired entries
    const expired = await admin.firestore().collection(AccessQueues.collectionName)
      .where('start', '<', Date.now() - AUTH_CODE_EXPIRE)
      .orderBy('start')
      .get();

    Logger.log({ message: `Expired: ${expired.docs.length}`, event: 'updateAccessQueue.access_queues.expired', count: expired.docs.length, category: LogCategory.METRIC });

    await Promise.all(expired.docs.map(async doc => {
      await admin.firestore().runTransaction(async t => {
        Logger.log(`deleting entry ${doc.id}`);
        const document = await t.get(doc.ref);
        t.delete(document.ref);
      });
    }));

    return { data: true };
  }

  static async alertBatchByEstimatedHours(hours: number): Promise<void> {
    const { accessQueue_limit } = await StateData.getStateData();
    // Estimate starting index in queue by amount of numbers let in every 5 minutes.
    const batchesPerHour = 12;
    const targetIndex = (accessQueue_limit * batchesPerHour) * hours;

    const totalQueueCount = await AccessQueues.getAccessQueuesCount();
    if (totalQueueCount < targetIndex) {
      Logger.log({ message: `Less numbers than the target index. Skipping alert message.`, event: 'AccessQueues.alertBatchByEstimatedHours', category: LogCategory.INFO });
      return;
    }

    const targetBatch = await admin.firestore().collection(AccessQueues.collectionName)
      .where('status', '==', 'queued')
      .orderBy('dateAdded')
      .offset(targetIndex)
      .limit(accessQueue_limit ?? 20)
      .get();

    const batchEmailAddresses = targetBatch.docs.map((doc) => {
      const data = doc.data();
      return data.email;
    });

    try {
      Logger.log({ message: `Attemping to alert messages to a batch of ${accessQueue_limit} numbers at queue index ${targetIndex}.`, event: 'AccessQueues.alertBatchByEstimatedHours', category: LogCategory.INFO });
      await Promise.all(
        batchEmailAddresses.map(async (email: string) => {
          if (isTesting()) {
            return;
          }
          await sgMail
            .send({
              to: email,
              from: 'ADA Handle <hello@adahandle.com>',
              templateId: 'd-79d22808fad74353b4ffc1083f1ea03c',
              dynamicTemplateData: {
                title: 'Almost Your Turn!',
                message: `Heads up! It's almost your turn to receive an access link to purchase your Handle. It may take around ${hours} to receive your access link, so we suggest turning on email notifications. Remember! Access links are only valid for 10 minutes upon receiving!`
              },
              hideWarnings: true
            })
            .catch((error) => {
              Logger.log({ message: JSON.stringify(error), event: 'postToQueueHandler.sendEmailConfirmation', category: LogCategory.INFO });
            });
        })
      );
      Logger.log({ message: `Done!`, event: 'AccessQueues.alertBatchByEstimatedHours', category: LogCategory.INFO });
    } catch (e) {
      Logger.log({ message: `Something went wrong: ${JSON.stringify(e)}`, event: 'AccessQueues.alertBatchByEstimatedHours', category: LogCategory.ERROR });
    }
  }

  static async addToQueue({ email, clientAgentSha, clientIp }: { email: string; clientAgentSha: string; clientIp: string; }): Promise<{ updated: boolean; alreadyExists: boolean }> {
    try {
      return admin.firestore().runTransaction(async t => {
        const snapshot = await t.get(admin.firestore().collection(AccessQueues.collectionName).where('email', '==', email).limit(1));
        if (!snapshot.empty) {
          return {
            updated: false,
            alreadyExists: true
          };
        }

        t.create(admin.firestore().collection(AccessQueues.collectionName).doc(), new AccessQueue({ email, clientAgentSha, clientIp }).toJSON());
        return {
          updated: true,
          alreadyExists: false
        };
      });
    } catch (error) {
      Logger.log({ message: JSON.stringify(error), event: 'addToQueue.error', category: LogCategory.ERROR });
      throw new Error(`Unable to add ${email} to queue`);
    }
  }
}
