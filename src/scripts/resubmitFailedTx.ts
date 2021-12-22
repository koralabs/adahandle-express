import * as admin from "firebase-admin";
import { Firebase } from "../helpers/firebase";
import { PaidSessions } from "../models/firestore/collections/PaidSessions";
import { PaidSession } from "../models/PaidSession";
import { fetch } from 'cross-fetch';
import { config } from 'dotenv';
config();

// 3.5 hours.
const TIMETHRESHOLD = 12600000;

const fetchNodeApp = async (
  endpoint: string,
  params: any = {}
): Promise<Response> => {
  const token = Buffer.from(
    `${process.env.NODEJS_APP_USERNAME}:${process.env.NODEJS_APP_PASSWORD}`
  ).toString('base64');

  const { headers, ...rest } = params;
  const baseUrl = process.env.NODEJS_APP_ENDPOINT;

  return fetch(
    `${baseUrl}/${endpoint}`,
    {
      headers: {
        'Authorization': `Basic ${token}`,
        ...headers,
      },
      ...rest
    }
  )
}

const run = async () => {
    await Firebase.init();
    const threshold = Date.now() - TIMETHRESHOLD

    const collection = await admin.firestore()
      .collection(PaidSessions.collectionName)
      .where('status', '==', 'submitted')
      .where('dateAdded', '<=', threshold)
      .orderBy('dateAdded')
      .get()
    const sessions = collection.docs.map(doc => doc.data() as PaidSession );
    console.log(`Total submitted sessions: ${sessions.length} older than ${threshold}`);
    await Promise.all(sessions.map(async (session) => {
      const data = await fetchNodeApp('/exists', {
        headers: {
          'x-handle': session.handle
        }
      }).then(res => res.json());

      if (data.error || data.exists || data.duplicate ) {
        console.log('Aborting status change. Check: ' + session.handle);
        return;
      }

      await admin.firestore().runTransaction(async t => {
          const ref = admin.firestore().collection(PaidSessions.collectionName).doc(session.id as string);
          t.update(ref, { status: 'pending', txId: '' });
          console.log('moved to pending');
          return true;
      }).catch(error => {
          console.log(error);
          return false;
      });
    }));
    // const oldSessions = sessions.filter(session => session.start <= threshold);
    // console.log(`Total old submitted sessions: ${oldSessions.length}`);
    // const mintedSessions = sessions.filter(session => mintedHandles.includes(session.handle));

    // Promise.all(mintedSessions.map(async session => {
    //   return admin.firestore().runTransaction(async t => {
    //       const ref = admin.firestore().collection(PaidSessions.collectionName).doc(session.id as string);
    //       t.update(ref, { status: 'confirmed' });
    //       return true;
    //   }).catch(error => {
    //       console.log(error);
    //       return false;
    //   });
    // }));
    process.exit();
}

run();
