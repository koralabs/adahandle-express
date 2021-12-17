import * as admin from "firebase-admin";
import { Firebase } from "../helpers/firebase";
import { PaidSessions } from "../models/firestore/collections/PaidSessions";
import { PaidSession } from "../models/PaidSession";
import { config } from 'dotenv';
config();

const run = async () => {
    await Firebase.init();
    const collection = await admin.firestore()
      .collection(PaidSessions.collectionName)
        .orderBy('dateAdded')
        .limit(0)
        .get()

    const sessions = collection.docs.map(doc => doc.data() as PaidSession );
    console.log(sessions.length);
    process.exit();
}

run();
