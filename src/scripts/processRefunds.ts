import { Firebase } from "../helpers/firebase";
import { handleExists } from "../helpers/graphql";
import { getRarityCost } from "../helpers/nft";
import { toADA } from "../helpers/utils";
import { PaidSessions } from "../models/firestore/collections/PaidSessions";
import { RefundableSessions } from "../models/firestore/collections/RefundableSessions";
import { RefundableSession } from "../models/RefundableSession";

interface RefundableSessionResult {
    notEnoughAda: RefundableSession[];
    invalidAda: RefundableSession[];
    refund: RefundableSession[];
    reProcess: RefundableSession[];
}

const isHandleOnChain = async (handle: string): Promise<boolean> => {
    try {
        const doesHandleExists = await handleExists(handle);
        const existingPaidSessions = await PaidSessions.getByHandles(handle);
        return doesHandleExists.exists || doesHandleExists.duplicate || existingPaidSessions.length > 1;
    } catch (error) {
        console.log('error', error);
        throw (error);
    }
};

const run = async () => {
    await Firebase.init();

    // get all refundable sessions
    const refundableSessions = await RefundableSessions.getRefundableSessions();
    console.log('refundableSessions count', refundableSessions.length);

    // iterate through all refundable sessions and see if cost matches rarity
    const { notEnoughAda, invalidAda, refund, reProcess } = await refundableSessions.reduce<Promise<RefundableSessionResult>>(async (acc, session) => {
        // if the cost is less than 2, delete the session. We do not refund under 2 ADA
        const { amount, handle } = session;
        const result = await acc;
        if (amount < 2) {
            result.notEnoughAda.push(session);
            return acc;
        }

        // if cost matches rarity, check to see if the handle is on chain.
        if (getRarityCost(handle) !== toADA(amount)) {
            // console.log(`${handle} - ${getRarityCost(handle)} !== ${toADA(amount)}`);
            result.invalidAda.push(session);
            return acc;
        }

        // if it is on chain, refund the ada
        const handleIsOnChain = await isHandleOnChain(handle);
        if (handleIsOnChain) {
            result.refund.push(session);
        } else {
            // if it is not on chain, create a new paid session with the same handle and cost
            result.reProcess.push(session);
        }
        return acc;
    }, Promise.resolve({ notEnoughAda: [], invalidAda: [], refund: [], reProcess: [] }));

    console.log(
        `notEnoughAda ${notEnoughAda.length}`,
        `invalidAda ${invalidAda.length}`,
        `refund ${refund.length}`,
        `reProcess ${reProcess.length}`
    );

    // TODO: delete notEnoughAda sessions
    // TODO: refund invalidAda sessions and set status to refunded
    // TODO: refund refund sessions and set status to refunded
    // TODO: create paid "pending" sessions for reProcess sessions

    process.exit();
}


run();
