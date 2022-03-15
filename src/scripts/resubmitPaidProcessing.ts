import { Firebase } from "../helpers/firebase";
import * as admin from "firebase-admin";
import { ActiveSessions } from "../models/firestore/collections/ActiveSession";
import { Status, WorkflowStatus } from "../models/ActiveSession";
import { MintingCache } from "../models/firestore/collections/MintingCache";
import { awaitForEach, chunk, delay } from "../helpers/utils";

const run = async () => {
    await Firebase.init();
    const db = admin.firestore();

    const snapshot = await admin.firestore().collection("activeSessions")
        .where('status', '==', 'paid')
        .where('workflowStatus', '==', 'processing').get();

    console.log('snapshot.size', snapshot.size);

    const olderThan4hours = new Date(Date.now() - 4 * 60 * 60 * 1000).getTime();
    const filteredItems = snapshot.docs.filter(item => {
        return item.data().dateAdded <= olderThan4hours;
    });

    const handles = filteredItems.map(s => s.data().handle as string);
    await MintingCache.removeHandlesFromMintCache(handles);

    const docsChunks = chunk(filteredItems, 500);

    let i = 0;

    await awaitForEach(docsChunks, async (docs, index) => {
        const batch = db.batch();
        docs.forEach(doc => {
            i++;
            console.log(`index ${i} for ${doc.id}`);
            batch.update(doc.ref, { workflowStatus: 'pending' });
            return;
        });

        await batch.commit();
        console.log(`Batch ${index} of ${docsChunks.length} completed`);
        await delay(1000);
    });
}

run();