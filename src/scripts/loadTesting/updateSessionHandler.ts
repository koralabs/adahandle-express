import { updateSessionsHandler } from "../../express/handlers/jobs/sessions";
import { Firebase } from "../../helpers/firebase";
import { WalletSimplifiedBalance } from "../../helpers/graphql";
import { delay, toLovelace } from "../../helpers/utils";
import { ActiveSession } from "../../models/ActiveSession";
import { AccessQueues } from "../../models/firestore/collections/AccessQueues";
import { ActiveSessions } from "../../models/firestore/collections/ActiveSession";
import { appendAccessQueueDataToFirestore } from "./appendAccessQueueData";

// create 3 sets of Session Tests
// 1. Session Test with expired sessions
// 2. Session Test with refundable sessions
// 3. Session Test with paid session
const createActiveSessions = async () => {
    const expiredSessions = Array.from({ length: 1 }, () => {
        const random = Math.random().toString().slice(2, 11);
        const activeSession = {
            phoneNumber: random,
            cost: 50,
            handle: `test-${random}`,
            wallet: {
                address: `exp_test${random}`
            },
            start: new Date().setMinutes(new Date().getMinutes() - 11),
        }
        return new ActiveSession({ ...activeSession });
    });

    const refundableSessions = Array.from({ length: 1 }, () => {
        const random = Math.random().toString().slice(2, 11);
        const activeSession = {
            phoneNumber: random,
            cost: 50,
            handle: `test-${random}`,
            wallet: {
                address: `refund_test${random}`
            },
            start: Date.now(),
        }
        return new ActiveSession({ ...activeSession });
    });

    const paidSessions = Array.from({ length: 1 }, () => {
        const random = Math.random().toString().slice(2, 11);
        const activeSession = {
            phoneNumber: random,
            cost: 50,
            handle: `test-${random}`,
            wallet: {
                address: `paid_test${random}`
            },
            start: Date.now(),
        }
        return new ActiveSession({ ...activeSession });
    });


    await ActiveSessions.addActiveSessions([...expiredSessions, ...refundableSessions, ...paidSessions]);
}

export const updateSessionHandlerTest = async () => {
    let index = 0;
    const getCheckPayments = (addresses: string[]): WalletSimplifiedBalance[] => {
        const checkPayments = addresses.map(address => {
            // first returns 0, second returns 45, third returns 50
            let amount = 0;

            if (address.includes('exp')) {
                amount = 0;
            } else if (address.includes('refund')) {
                amount = 45;
            } else if (address.includes('paid')) {
                amount = 50;
            }

            const simplifiedBalance: WalletSimplifiedBalance = {
                address,
                amount: toLovelace(amount)
            }

            return simplifiedBalance
        });

        return checkPayments;
    }

    try {
        // @ts-expect-error
        updateSessionsHandler({}, {}, getCheckPayments);
        //await delay(1);
        // @ts-expect-error
        await updateSessionsHandler({}, {}, getCheckPayments);
    } catch (error) {
        console.log(error);
    }
}

const run = async () => {
    await Firebase.init();
    await createActiveSessions();
    await updateSessionHandlerTest();
}

run();
