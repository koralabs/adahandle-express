import { PaidSession } from "../models/PaidSession";

const arr = [
    {
        start: 1639762002294,
        handle: 'happy',
        txId: 'test_txid',
        wallet: {
            address: 'testaddr'
        },
        dateAdded: 1639762142652,
        status: 'submitted',
        cost: 50,
        attempts: 0,
        id: 'testid',
        emailAddress: ''
    }
];

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