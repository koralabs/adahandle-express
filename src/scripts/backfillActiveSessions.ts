import { Firebase } from "../helpers/firebase";
import { ActiveSession } from "../models/ActiveSession";
import { ActiveSessions } from "../models/firestore/collections/ActiveSession";

/**
 * Script is designed to backfill the ActiveSession collection with model updates
 */
const run = async () => {
    await Firebase.init();

    // get all current paid sessions
    // get all refundable sessions
    // get all dlq sessions

    // create active sessions with the following details
    // - status
    // - workflow status
    // - paidAddress
    // - returnAddress

    process.exit();
}


run();
