import { Firebase } from "../helpers/firebase";
import { ActiveSession } from "../models/ActiveSession";
import { ActiveSessions } from "../models/firestore/collections/ActiveSession";
import { PaidSessions } from "../models/firestore/collections/PaidSessions";
import { PaidSession } from "../models/PaidSession";


const run = async () => {
    await Firebase.init();

    const paidSession = new PaidSession({
        phoneNumber: '+12223334444',
        cost: 0,
        handle: 'burritos',
        wallet: {
            address: `addr_test${new Date().getTime()}`
        },
        start: 1234,
    });

    const paidSession2 = new PaidSession({
        phoneNumber: '+12223334444',
        cost: 0,
        handle: 'tacos',
        wallet: {
            address: `addr_test${new Date().getTime() + 1}`
        },
        start: 1234,
    });

    await PaidSessions.addPaidSessions([paidSession, paidSession2]);

    const paidSessions = await PaidSessions.getPaidSessions();
    console.log('paidSessions', paidSessions);

    await PaidSessions.removePaidSessions([paidSession]);

    const allPaidSessions = await PaidSessions.getPaidSessions();
    console.log('allPaidSessions', allPaidSessions);

    process.exit();
}


run();