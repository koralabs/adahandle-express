import { Firebase } from "../helpers/firebase";
import { PaidSessions } from "../models/firestore/collections/PaidSessions";
import { RefundableSessions } from "../models/firestore/collections/RefundableSessions";
import { RefundableSession } from "../models/RefundableSession";


const run = async () => {
    await Firebase.init();

    const paidSession = new RefundableSession({
        wallet: {
            address: `addr_test${new Date().getTime()}`
        },
        amount: 1234,
        handle: "handle_1"
    });

    const paidSession2 = new RefundableSession({
        wallet: {
            address: `addr_test${new Date().getTime() + 1}`
        },
        amount: 1234, handle: "handle_2"
    });

    await RefundableSessions.addRefundableSessions([paidSession, paidSession2]);

    const refundableSessions = await RefundableSessions.getRefundableSessions();
    console.log('refundableSessions', refundableSessions);

    await RefundableSessions.removeSessionByWalletAddress(paidSession.wallet.address);

    const remainingSessions = await PaidSessions.getPaidSessionsUnsafe();
    console.log('remainingSessions', remainingSessions);

    process.exit();
}


run();
