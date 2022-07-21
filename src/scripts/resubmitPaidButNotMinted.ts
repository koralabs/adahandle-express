import { Firebase } from "../helpers/firebase";
import * as admin from "firebase-admin";
import { ActiveSession, Status, WorkflowStatus } from "../models/ActiveSession";
import { MintingCache } from "../models/firestore/collections/MintingCache";
import { asyncForEach } from "../helpers/utils";
import { ReservedHandles } from "../models/firestore/collections/ReservedHandles";
import { GraphqlHandleExistsResponse, handleExists } from "../helpers/graphql";

const paidButNotMinted = []

const run = async () => {
    await Firebase.init();
    const db = admin.firestore();

    await asyncForEach(paidButNotMinted, async (handle, index) => {
        console.log(`index ${index} for ${handle}`);
        const exists: GraphqlHandleExistsResponse = await handleExists(handle);
        const response = await ReservedHandles.checkAvailability(handle)
        if (!exists.exists && response.type == 'pending') {
            await admin.firestore().runTransaction(async (t) => {
                await MintingCache.removeHandlesFromMintCache([handle]);
                const snapshot = await t.get(admin.firestore().collection("activeSessions").where("handle", "==", handle));
                if (snapshot && snapshot.size > 0) {
                    const sessions = snapshot.docs.map(d => d.data() as ActiveSession)
                        .filter(s => s.returnAddress 
                            && (
                                (s.status == Status.REFUNDABLE && (s.refundAmount || 0) >= s.cost)
                                || (s.status == Status.PAID && s.workflowStatus == WorkflowStatus.SUBMITTED)
                            )
                        )
                        .sort((a, b) => ((b.dateAdded ?? 0) - (a.dateAdded ?? 0)));
                    if (sessions && sessions.length > 0) {
                        const handleReservation = sessions[0];
                        const ref = snapshot.docs.find(d => (d.data() as ActiveSession).id == handleReservation.id)?.ref;
                        if (ref) {
                        t.update(ref, {
                            ...handleReservation,
                            status: Status.PAID,
                            workflowStatus: WorkflowStatus.PENDING,
                            refundAmount: 0
                        });
                        }
                        console.log(`${handle} updated`);
                    }
                    else {
                        console.log(`Couldn't find a viable record for handle ${handle}`);
                    }
                }
            });
        }
        else {
            console.log(`${handle}: existsOnChain=${exists.exists}, available=${response.available}`)
        }
    }, 250);
}

run();