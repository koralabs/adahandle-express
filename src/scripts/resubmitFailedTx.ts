import * as admin from "firebase-admin";
import { Firebase } from "../helpers/firebase";
import { PaidSessions } from "../models/firestore/collections/PaidSessions";
import { PaidSession } from "../models/PaidSession";
import { config } from 'dotenv';
config();

// 3.5 hours.
const TIMETHRESHOLD = 12600000;

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
    console.log(sessions.length);

    // await PaidSessions.updateSessionStatuses('', sessions, 'pending');
    process.exit();
}

run();
