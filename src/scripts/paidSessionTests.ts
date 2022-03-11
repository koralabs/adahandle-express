import { Firebase } from "../helpers/firebase";
import { ActiveSessions } from "../models/firestore/collections/ActiveSession";
import { ActiveSession, Status } from "../models/ActiveSession";
import { CreatedBySystem } from "../helpers/constants";


const run = async () => {
    await Firebase.init();

    const paidSession = new ActiveSession({
        emailAddress: '+12223334444',
        cost: 0,
        handle: 'burritos',
        paymentAddress: `addr_test${new Date().getTime()}`,
        start: 1234,
        createdBySystem: CreatedBySystem.UI
    });

    const paidSession2 = new ActiveSession({
        emailAddress: '+12223334444',
        cost: 0,
        handle: 'tacos',
        paymentAddress: `addr_test${new Date().getTime() + 1}`,
        start: 1234,
        createdBySystem: CreatedBySystem.UI
    });

    await ActiveSessions.addActiveSessions([paidSession, paidSession2]);

    const paidSessions = await ActiveSessions.getByStatus({statusType: Status.PAID });
    console.log('paidSessions', paidSessions);

    paidSession.status = Status.DLQ;
    await ActiveSessions.updateSessions([paidSession]);

    const allPaidSessions = await ActiveSessions.getByStatus({statusType: Status.PAID });
    console.log('allPaidSessions', allPaidSessions);

    process.exit();
}


run();
