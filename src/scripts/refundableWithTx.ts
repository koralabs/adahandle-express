import * as admin from "firebase-admin";
import { Firebase } from "../helpers/firebase";

const run = async () => {
    await Firebase.init();

    // get all refundable activeSessions
    const snapshot = await admin.firestore().collection("activeSessions").where('status', '==', 'refundable').get();
    console.log(`${snapshot.size} activeSessions found`);

    // get all where txId is not empty
    const itemsWithTxId = snapshot.docs.filter(doc => {
        const data = doc.data();
        return data.txId && data.txId != '';
    });

    console.log(`itemsWithTxId`, itemsWithTxId.map(doc => {
        const data = doc.data();
        return { id: doc.id, txId: data.txId, email: data.email, handle: data.handle, workflowStatus: data.workflowStatus }
    }));
}

run();