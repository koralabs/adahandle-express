import { Firebase } from "../helpers/firebase";
import { ActiveSessions } from "../models/firestore/collections/ActiveSession";
import { config } from 'dotenv';
import { Status, WorkflowStatus } from "../models/ActiveSession";
config();

const run = async () => {
    await Firebase.init();
    const sessions = await ActiveSessions.getByStatus({ statusType: Status.PENDING, limit: 1000 });

    console.log('sessions', sessions);
    await ActiveSessions.updateWorkflowStatusAndTxIdForSessions('', sessions, WorkflowStatus.PENDING);

    process.exit();
}

run();
