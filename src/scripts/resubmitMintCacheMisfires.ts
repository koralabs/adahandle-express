import { Firebase } from "../helpers/firebase";
import * as admin from "firebase-admin";
import { ActiveSession, Status, WorkflowStatus } from "../models/ActiveSession";
import { MintingCache } from "../models/firestore/collections/MintingCache";
import { asyncForEach } from "../helpers/utils";

const mintCacheButNotOnChain = [
]

const run = async () => {
    await Firebase.init();
    const db = admin.firestore();

    await MintingCache.removeHandlesFromMintCache(mintCacheButNotOnChain);

    await asyncForEach(mintCacheButNotOnChain, async (handle, index) => {
        console.log(`index ${index} for ${handle}`);
        await admin.firestore().runTransaction(async (t) => {
            const snapshot = await t.get(admin.firestore().collection("activeSessions").where("handle", "==", handle));
            if (snapshot && snapshot.size > 0) {
                const sessions = snapshot.docs.map(d => d.data() as ActiveSession).filter(s => s.returnAddress).sort((a,b) => (b.dateAdded - a.dateAdded));
                if (sessions && sessions.length > 0) {
                    const handleReservation = sessions[0];
                    const ref = snapshot.docs.find(d => (d.data() as ActiveSession).id == handleReservation.id).ref;
                    t.update(ref, {
                        ...handleReservation,
                        status: Status.PAID,
                        workflowStatus: WorkflowStatus.PENDING,
                        refundAmount: 0
                    });
                    console.log(`${handle} updated`);
                }
            }
        })
    }, 250);
}

run();