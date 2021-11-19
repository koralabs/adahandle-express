import { Firebase } from "../helpers/firebase";
import { PaidSessions } from "../models/firestore/collections/PaidSessions";


const run = async () => {
    await Firebase.init();
    const sessions = await PaidSessions.getByStatus({ statusType: 'processing', limit: 1000 });

    console.log('sessions', sessions);
    await PaidSessions.updateSessionStatuses('', sessions, 'pending');

    process.exit();
}

run();
