import { Firebase } from "../helpers/firebase";
import * as admin from "firebase-admin";
import { asyncForEach, awaitForEach, chunk, delay } from "../helpers/utils";
import { MintingCache } from "../models/firestore/collections/MintingCache";

const run = async () => {
    // get minting cache collection
    await Firebase.init();
    const db = admin.firestore();
    const snapshot = await admin.firestore().collection(MintingCache.collectionName).get();

    // add new minting cache with bookends
    const start = new Date().getTime();

    console.log(`snapshot size: ${snapshot.size}`);

    const docsChunks = chunk(snapshot.docs, 500);

    let i = 0;

    await awaitForEach(docsChunks, async (docs, index) => {
        const batch = db.batch();
        docs.forEach(doc => {
            i++;
            const handleWithBookends = MintingCache.getHandleWithBookends(doc.id);
            console.log(`index ${i} for ${doc.id} adding ${handleWithBookends}`);
            const docRef = db.collection(MintingCache.collectionName).doc(handleWithBookends);
            const newDoc = { id: handleWithBookends };
            batch.create(docRef, newDoc);
        });

        await batch.commit();
        console.log(`Batch ${index} of ${docsChunks.length} completed`);
        await delay(1000);
    });

    const end = new Date().getTime();
    const time = end - start;
    console.log(`Execution time: ${time}`);

    process.exit();
}

run()