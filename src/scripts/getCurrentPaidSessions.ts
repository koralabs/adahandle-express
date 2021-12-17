import { Firebase } from "../helpers/firebase";
import { PaidSessions } from "../models/firestore/collections/PaidSessions";


const run = async () => {
    await Firebase.init();

    // const paidSessions = await PaidSessions.getByStatus({ statusType: "confirmed", limit: 15000 });
    const paidSessions = await PaidSessions.getPaidSessionsUnsafe();

    console.log('paidSessions size', paidSessions.length);

    let total = 0;
    for (let i = 0; i < paidSessions.length; i++) {
        const paidSession = paidSessions[i];
        total += paidSession.cost;
    }

    console.log('ADA', total);

    process.exit();
}

run();