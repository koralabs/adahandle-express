import * as admin from "firebase-admin";
import { awaitForEach, chunk, delay } from "../../helpers/utils";

export const batchUpdate = async (
    docs: admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>[],
    buildUpdateObject: (doc: admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>) => Promise<Record<string, unknown>>,
    chunksSize = 500
): Promise<void> => {
    const db = admin.firestore();
    const docsChunks = chunk(docs, chunksSize);

    let i = 0;

    await awaitForEach(docsChunks, async (docs, index) => {
        const batch = db.batch();

        await awaitForEach(docs, async (doc) => {
            i++;
            console.log(`index ${i} for ${doc.id}`);

            const update = await buildUpdateObject(doc);
            console.log(update);

            batch.update(doc.ref, update);
            return;
        })

        await batch.commit();
        console.log(`Batch ${index} of ${docsChunks.length} completed`);
        await delay(1000);
    });
}