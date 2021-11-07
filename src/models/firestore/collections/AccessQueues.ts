import * as admin from "firebase-admin";
import { AUTH_CODE_EXPIRE } from "../../../helpers/constants";
import { createTwilioVerification } from "../../../helpers/twilo";
import { delay } from "../../../helpers/utils";
import { AccessQueue } from "../../AccessQueue";
import { buildCollectionNameWithSuffix } from "./lib/buildCollectionNameWithSuffix";

interface AccessQueuePosition { updated: boolean; alreadyExists: boolean; position: number; dateAdded?: number, documentId?: string }

export class AccessQueues {
  public static readonly collectionName = buildCollectionNameWithSuffix('accessQueues');

  static async getAccessQueues(): Promise<AccessQueue[]> {
    const collection = await admin.firestore().collection(AccessQueues.collectionName).get();
    return collection.docs.map(doc => doc.data() as AccessQueue);
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
      console.log(error);
      throw new Error(`Unable to remove queues for ${phone}`);
    }
  }

  static async updateAccessQueue(): Promise<{ data: boolean }> {
    console.log('fetching access queue...');

    const pendingQuery = admin.firestore().collection(AccessQueues.collectionName);
    pendingQuery.where('status', '==', 'queued');
    pendingQuery.where('dateAdded', '>', new Date().getTime() - AUTH_CODE_EXPIRE);
    const pending = await pendingQuery.orderBy('dateAdded').limit(20).get();

    console.log(`Pending: ${pending.docs.length}`);
    await Promise.all(pending.docs.map(async doc => {
      const entry = doc.data();
      await delay(Math.floor(Math.random() * 100));
      // TODO: Add twilio verification
      const data = { sid: 'test', status: 'pending' } //await createTwilioVerification(entry.phone).catch(e => console.log(e));
      if (data) {
        await admin.firestore().runTransaction(async t => {
          console.log(`updated entry ${doc.id}`);
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

    const expired = await admin.firestore().collection(AccessQueues.collectionName)
      .where('start', '<', Date.now() - AUTH_CODE_EXPIRE)
      .orderBy('start')
      .get();

    console.log(`Expired: ${expired.docs.length}`);
    await Promise.all(expired.docs.map(async doc => {
      await admin.firestore().runTransaction(async t => {
        console.log(`deleting entry ${doc.id}`);
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
      console.log(error);
      throw new Error(`Unable to get details about queues for ${phone}`);
    }
  }
}
