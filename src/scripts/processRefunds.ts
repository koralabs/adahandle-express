import { Firebase } from "../helpers/firebase";
import { handleExists } from "../helpers/graphql";
import { getRarityCost } from "../helpers/nft";
import { ActiveSession, Status } from "../models/ActiveSession";
import { ActiveSessions } from "../models/firestore/collections/ActiveSession";

interface RefundableSessionResult {
    notEnoughAda: ActiveSession[];
    invalidAda: ActiveSession[];
    refund: ActiveSession[];
    reProcess: ActiveSession[];
}

const isHandleOnChain = async (handle: string): Promise<boolean> => {
    try {
        const doesHandleExists = await handleExists(handle);
        const existingPaidSessions = await ActiveSessions.getByHandle(handle);
        return doesHandleExists.exists || doesHandleExists.duplicate || existingPaidSessions.length > 1;
    } catch (error) {
        console.log('error', error);
        throw (error);
    }
};

const run = async () => {
    await Firebase.init();

    // get all refundable sessions
    const refundableSessions = await ActiveSessions.getByStatus({statusType: Status.REFUNDABLE});
    console.log('refundableSessions count', refundableSessions.length);

    // iterate through all refundable sessions and see if cost matches rarity
    const { notEnoughAda, invalidAda, refund, reProcess } = await refundableSessions.reduce<Promise<RefundableSessionResult>>(async (acc, session) => {
        // if the cost is less than 2, delete the session. We do not refund under 2 ADA
        const { refundAmount, handle } = session;
        const result = await acc;
        if (refundAmount < 2) {
            result.notEnoughAda.push(session);
            return acc;
        }

        // if cost matches rarity, check to see if the handle is on chain.
        if (getRarityCost(handle) !== refundAmount) {
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

    // const amounts = [...invalidAda, ...refund, ...reProcess].map(session => session.amount);
    // console.log(`Total amount: ${toADA(amounts.reduce((total, curr) => total += curr, 0))}`);


    // TODO: delete notEnoughAda sessions
    // TODO: refund invalidAda sessions and set status to refunded
    // TODO: refund refund sessions and set status to refunded
    // TODO: create paid "pending" sessions for reProcess sessions

    process.exit();
}


run();
