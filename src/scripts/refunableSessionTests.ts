import { Firebase } from "../helpers/firebase";
import { ActiveSessions } from "../models/firestore/collections/ActiveSession";
import { ActiveSession, Status, WorkflowStatus } from "../models/ActiveSession";


const run = async () => {
    await Firebase.init();

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const paidSession = new ActiveSession({
        paymentAddress: `addr_test${new Date().getTime()}`,
        refundAmount: 1234,
        handle: "handle_1"
    });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const paidSession2 = new ActiveSession({
        paymentAddress: `addr_test${new Date().getTime() + 1}`,
        refundAmount: 1234,
        handle: "handle_2"
    });

    await ActiveSessions.addActiveSessions([paidSession, paidSession2]);

    const refundableSessions = await ActiveSessions.getByStatus({statusType:Status.REFUNDABLE});
    console.log('refundableSessions', refundableSessions);

    paidSession.status = Status.REFUNDABLE;
    paidSession.workflowStatus = WorkflowStatus.SUBMITTED;
    await ActiveSessions.updateSessions([paidSession]);

    const remainingSessions = await ActiveSessions.getByStatus({statusType: Status.PAID});
    console.log('remainingSessions', remainingSessions);

    process.exit();
}


run();
