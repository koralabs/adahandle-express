import * as admin from "firebase-admin";

import { Firebase } from "../helpers/firebase";
import { awaitForEach, chunk, delay } from "../helpers/utils";
import { AccessQueues } from "../models/firestore/collections/AccessQueues";

const lookupStatus = 'wait_for_publish';
const updatingStatus = 'pending'

// const updateSessions = async () => {
//     const start = new Date().getTime();

//     const db = admin.firestore();
//     const snapshot = await db.collection(AccessQueues.collectionName).where('status', '==', lookupStatus).get();
//     console.log(`snapshot size: ${snapshot.size}`);

//     const docsChunks = chunk(snapshot.docs, 500);

//     let i = 0

//     await awaitForEach(docsChunks, async (docs, index) => {
//         const batch = db.batch();
//         docs.forEach(doc => {
//             i++;
//             console.log(`index ${i} for ${doc.id}`);
//             batch.update(doc.ref, { status: updatingStatus });
//         });

//         await batch.commit();
//         console.log(`Batch ${index} of ${docsChunks.length} completed`);
//         await delay(1000);
//     });

//     const end = new Date().getTime();
//     const time = end - start;
//     console.log(`Execution time: ${time}`);
// }

const updatePending = async () => {
    const start = new Date().getTime();

    const db = admin.firestore();
    const snapshot = await db.collection(AccessQueues.collectionName).get();
    console.log(`snapshot size: ${snapshot.size}`);

    const docsChunks = chunk(snapshot.docs, 500);

    let i = 0;
    let oops = 0;

    await awaitForEach(docsChunks, async (docs, index) => {
        const batch = db.batch();
        docs.forEach(doc => {
            i++;
            console.log(`index ${i} for ${doc.id}`);
            const docData = doc.data();
            if (docData.status === 'queued' || docData.status === 'pending') {
                if (docData.status === 'queued') {
                    batch.update(doc.ref, { status: 'queued_backup' });
                    return;
                }

                if (docData.authCode && docData.status === 'pending') {
                    batch.update(doc.ref, { status: 'pending_backup' });
                } else {
                    batch.update(doc.ref, { status: 'queued_backup' });
                    oops++;
                }
                return;
            }

            console.log(`${doc.id} has a status of ${docData.status}`);
            return;
        });

        await batch.commit();
        console.log(`Batch ${index} of ${docsChunks.length} completed with ${oops} oops`);
        await delay(1000);
    });

    const end = new Date().getTime();
    const time = end - start;
    console.log(`Execution time: ${time}`);
}

const run = async () => {
    await Firebase.init();
    console.log(`starting`);
    await updatePending();
}

run();