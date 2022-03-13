import * as admin from "firebase-admin";

import { AccessQueues } from "../../models/firestore/collections/AccessQueues";
import { awaitForEach, chunk, delay } from "../../helpers/utils";
import { Firebase } from "../../helpers/firebase";

const lookupStatus = 'queued_backup';
const updatingStatus = 'queued';

const updateSessions = async () => {
    await Firebase.init();
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
            batch.update(doc.ref, { status: updatingStatus });
        });

        await batch.commit();
        console.log(`Batch ${index} of ${docsChunks.length} completed`);
        await delay(1000);
    });

    const end = new Date().getTime();
    const time = end - start;
    console.log(`Execution time: ${time}`);
}