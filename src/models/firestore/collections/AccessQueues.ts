import * as admin from "firebase-admin";
import { AUTH_CODE_EXPIRE } from "../../../helpers/constants";
import { createTwilioVerification } from "../../../helpers/twilo";
import { AccessQueue } from "../../AccessQueue";
import { buildCollectionNameWithSuffix } from "./lib/buildCollectionNameWithSuffix";

export class AccessQueues {
  public static readonly collectionName = buildCollectionNameWithSuffix('accessQueues');

  static async getAccessQueues(): Promise<AccessQueue[]> {
    const collection = await admin.firestore().collection(AccessQueues.collectionName).get();
    return collection.docs.map(doc => doc.data() as AccessQueue);
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
      console.log(error);
      throw new Error(`Unable to remove queues for ${phone}`);
    }
  }

  static async updateAccessQueue(): Promise<void> {
    await admin.firestore().runTransaction(async t => {
      const snapshot = await t.get(admin.firestore().collection(AccessQueues.collectionName));
      if (snapshot.empty) {
        return;
      }

      await Promise.all(
        snapshot.docs
          .map(async (doc, index) => {

            // Commenting out for now as this limitation could prevent the queue from filling up.
            // if (index > 20) {
            //   return;
            // }

            const entry = doc.data() as AccessQueue;

            // Remove if older than 10 minutes.
            if (entry?.start && Date.now() - entry.start > AUTH_CODE_EXPIRE) {
              t.delete(doc.ref);
              return;
            }

            // Ignore if pending.
            if (entry?.status === 'pending') {
              return;
            }

            // Sends auth code!
            const data = await createTwilioVerification(entry.phone).catch(e => console.log(e));
            console.log(JSON.stringify(data));
            data && t.update(doc.ref, {
              phone: entry.phone,
              sid: data.sid,
              status: data.status,
              start: Date.now(),
            });
          }))
    });
  }

  static async addToQueueAndGetPosition(phone: string): Promise<{ updated: boolean; alreadyExists: boolean; position: number; }> {
    try {
      return admin.firestore().runTransaction(async t => {
        const accessQueueRef = admin.firestore().collection(AccessQueues.collectionName);
        const orderedSnapshot = await t.get(accessQueueRef.orderBy('dateAdded'));

        // If the document already exists, get the position and return
        const alreadyExists = orderedSnapshot.docs.some(doc => doc?.data()?.phone === phone);
        if (alreadyExists) {
          return {
            updated: false,
            alreadyExists,
            position: orderedSnapshot.docs.findIndex(doc => doc?.data()?.phone === phone) + 1
          };
        }

        // otherwise set the position and add to the queue
        const position = orderedSnapshot.docs.length + 1;

        t.set(accessQueueRef.doc(), new AccessQueue({ phone }).toJSON());

        return {
          updated: true,
          alreadyExists,
          position
        };
      });
    } catch (error) {
      console.log(error);
      throw new Error(`Unable to get details about queues for ${phone}`);
    }
  }
}
