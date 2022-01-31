import { Firebase } from "../helpers/firebase";
import { PaidSessions } from "../models/firestore/collections/PaidSessions";
import { RefundableSessions } from "../models/firestore/collections/RefundableSessions";
import { RefundableSession } from "../models/RefundableSession";


const run = async () => {
    await Firebase.init();

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const paidSession = new RefundableSession({
        paymentAddress: `addr_test${new Date().getTime()}`,
        amount: 1234,
        handle: "handle_1"
    });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const paidSession2 = new RefundableSession({
        paymentAddress: `addr_test${new Date().getTime() + 1}`,
        amount: 1234,
        handle: "handle_2"
    });

    await RefundableSessions.addRefundableSessions([paidSession, paidSession2]);

    const refundableSessions = await RefundableSessions.getRefundableSessions();
    console.log('refundableSessions', refundableSessions);

    await RefundableSessions.removeSessionByWalletAddress(paidSession.paymentAddress);

    const remainingSessions = await PaidSessions.getPaidSessionsUnsafe();
    console.log('remainingSessions', remainingSessions);

    process.exit();
}


run();
