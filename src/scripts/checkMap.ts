import { PaidSession } from "../models/PaidSession";

const arr = [];

const run = async () => {
    const groupedPaidSessionsByTxIdMap = arr.reduce<Map<string, PaidSession[]>>((acc, session) => {
        const sessions = acc.get(session.txId) ?? [];
        acc.set(session.txId, [...sessions, session as PaidSession]);
        // if (session.txId && !acc.has(session.txId)) {
        //     const sessions = acc.get(session.txId) ?? [];
        //     acc.set(session.txId, [...sessions]);
        // } else {
        //     acc.set(session.txId, [...sessions, session]);
        // }

        return acc;
    }, new Map());

    console.log('groupedPaidSessionsByTxIdMap', groupedPaidSessionsByTxIdMap)

    process.exit();
}

run();