import * as admin from "firebase-admin";

import { Firebase } from "../helpers/firebase";
import { awaitForEach, chunk, delay } from "../helpers/utils";
import { AccessQueues } from "../models/firestore/collections/AccessQueues";

const lookupStatus = 'pending';
const updatingStatus = 'wait_for_publish'

const updateSessions = async () => {
    const start = new Date().getTime();

    const db = admin.firestore();
    const snapshot = await db.collection(AccessQueues.collectionName).where('status', '==', lookupStatus).get();
    console.log(`snapshot size: ${snapshot.size}`);

    const docsChunks = chunk(snapshot.docs, 500);

    let i = 0

    await awaitForEach(docsChunks, async (docs, index) => {
        const batch = db.batch();
        docs.forEach(doc => {
            i++;
            console.log(`index ${i} for ${doc.id}`);
            batch.update(doc.ref, { status: updatingStatus, start: admin.firestore.FieldValue.delete() });
        });

        await batch.commit();
        console.log(`Batch ${index} of ${docsChunks.length} completed`);
        await delay(1000);
    });

    const end = new Date().getTime();
    const time = end - start;
    console.log(`Execution time: ${time}`);
}

const run = async () => {
    await Firebase.init();
    console.log(`starting`);
    await updateSessions();
}

run();