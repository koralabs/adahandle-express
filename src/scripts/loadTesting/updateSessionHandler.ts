import { updateSessionsHandler } from "../../express/handlers/jobs/sessions";
import { CreatedBySystem } from "../../helpers/constants";
import { Firebase } from "../../helpers/firebase";
import { WalletSimplifiedBalance } from "../../helpers/graphql";
import { delay, toLovelace } from "../../helpers/utils";
import { ActiveSession } from "../../models/ActiveSession";
import { ActiveSessions } from "../../models/firestore/collections/ActiveSession";

// create 3 sets of Session Tests
// 1. Session Test with expired sessions
// 2. Session Test with refundable sessions
// 3. Session Test with paid session
const createActiveSessions = async () => {
    const expiredSessions = Array.from({ length: 1 }, () => {
        const random = Math.random().toString().slice(2, 11);
        const activeSession = {
            emailAddress: random,
            cost: 50,
            handle: `test-${random}`,
            paymentAddress: `exp_test${random}`,
            start: new Date().setMinutes(new Date().getMinutes() - 11),
            createdBySystem: CreatedBySystem.UI
        }
        return new ActiveSession({ ...activeSession });
    });

    const refundableSessions = Array.from({ length: 1 }, () => {
        const random = Math.random().toString().slice(2, 11);
        const activeSession = {
            emailAddress: random,
            cost: 50,
            handle: `test-${random}`,
            paymentAddress: `refund_test${random}`,
            start: Date.now(),
            createdBySystem: CreatedBySystem.UI
        }
        return new ActiveSession({ ...activeSession });
    });

    const paidSessions = Array.from({ length: 1 }, () => {
        const random = Math.random().toString().slice(2, 11);
        const activeSession = {
            emailAddress: random,
            cost: 50,
            handle: `test-${random}`,
            paymentAddress: `paid_test${random}`,
            start: Date.now(),
            createdBySystem: CreatedBySystem.UI
        }
        return new ActiveSession({ ...activeSession });
    });


    await ActiveSessions.addActiveSessions([...expiredSessions, ...refundableSessions, ...paidSessions]);
}

export const updateSessionHandlerTest = async () => {
    const getCheckPayments = async (addresses: string[]): Promise<WalletSimplifiedBalance[]> => {
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
                amount: toLovelace(amount),
                returnAddress: 'test'
            }

            return simplifiedBalance
        });
        await delay(10000);
        return checkPayments;
    }

    try {
        await createActiveSessions();

        // @ts-expect-error passing in empty objects instead of express request and response
        updateSessionsHandler({}, {}, getCheckPayments);
        await delay(2000);
        await createActiveSessions();
        await delay(5000);

        // @ts-expect-error passing in empty objects instead of express request and response
        await updateSessionsHandler({}, {}, getCheckPayments);

        await delay(10000);
        // @ts-expect-error passing in empty objects instead of express request and response
        await updateSessionsHandler({}, {}, getCheckPayments);
    } catch (error) {
        console.log(error);
    }
}

const run = async () => {
    await Firebase.init();
    await updateSessionHandlerTest();
}

run();
