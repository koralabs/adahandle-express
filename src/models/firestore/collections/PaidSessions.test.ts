import * as admin from "firebase-admin";
import { PaidSession } from "../../PaidSession";
import { cleanupTesting, initTesting } from "./lib/testBase";

import { PaidSessions } from "./PaidSessions";

describe('PaidSessions Tests', () => {
    let app: admin.app.App;
    let db: admin.firestore.Firestore;

    beforeEach(async () => {
        ({ app, db } = initTesting());
    });

    afterEach(async () => {
        await cleanupTesting(db, app, { collections: [PaidSessions.collectionName, PaidSessions.collectionNameDLQ] });
    });

    it('should have the correct collection name for develop', () => {
        expect(PaidSessions.collectionName).toEqual('paidSessions_dev');
    });

    it('should remove queues and add to DLQ', async () => {
        const paidSessions = [
            new PaidSession({ phoneNumber: '111-111-1111', cost: 20, handle: 'tacos', wallet: { address: 'test_addr1' }, start: Date.now() }),
            new PaidSession({ phoneNumber: '222-222-2222', cost: 20, handle: 'tacos', wallet: { address: 'test_addr2' }, start: Date.now() }),
            new PaidSession({ phoneNumber: '333-333-3333', cost: 20, handle: 'tacos', wallet: { address: 'test_addr3' }, start: Date.now() })
        ];

        await PaidSessions.addPaidSessions(paidSessions);

        const allSessions = await PaidSessions.getPaidSessionsUnsafe();
        const session1 = allSessions.find(s => s.wallet.address === 'test_addr1') as PaidSession;
        const session2 = allSessions.find(s => s.wallet.address === 'test_addr2') as PaidSession;

        await PaidSessions.removeAndAddToDLQ([session1, session2]);

        const sessions = await PaidSessions.getPaidSessionsUnsafe();

        expect(sessions.length).toEqual(1);
        expect(sessions[0]).toEqual({ ...paidSessions[2], status: 'pending', id: expect.any(String), start: expect.any(Number) });

        const dlqSessions = await PaidSessions.getDLQPaidSessionsUnsafe();
        expect(dlqSessions.length).toEqual(2);
    });

    describe('updateSessionStatuses', () => {
        it('should update sessions statuses and add txId', async () => {
            const paidSessions = [
                new PaidSession({ phoneNumber: '111-111-1111', cost: 20, handle: 'tacos', wallet: { address: 'test_addr1' }, start: Date.now() }),
                new PaidSession({ phoneNumber: '222-222-2222', cost: 20, handle: 'tacos', wallet: { address: 'test_addr2' }, start: Date.now() })
            ];

            await PaidSessions.addPaidSessions(paidSessions);

            const sessions = await PaidSessions.getPaidSessionsUnsafe();

            const txId = 'txId12345';
            const status = 'submitted';
            await PaidSessions.updateSessionStatuses(txId, sessions, status);

            const sessionsAfterUpdate = await PaidSessions.getPaidSessionsUnsafe();
            sessionsAfterUpdate.sort((a, b) => a.phoneNumber.localeCompare(b.phoneNumber));

            expect(sessionsAfterUpdate).toEqual([
                { ...paidSessions[0], id: expect.any(String), status, txId },
                { ...paidSessions[1], id: expect.any(String), status, txId },
            ]);
        });
    });

    describe('getByStatus', () => {
        it('should get 10 sessions with status pending', async () => {
            const paidSessionsPending = Array.from({ length: 12 }, () => {
                const random = Math.random().toString().slice(2, 11);
                return new PaidSession({ phoneNumber: random, cost: 20, handle: random, wallet: { address: `test_addr${random}` }, start: Date.now() })
            });

            const paidSessionsSubmitted = Array.from({ length: 3 }, () => {
                const random = Math.random().toString().slice(2, 11);
                return new PaidSession({ phoneNumber: random, cost: 20, handle: random, wallet: { address: `test_addr${random}` }, start: Date.now(), status: 'submitted' })
            });

            const paidSessionsConfirmed = Array.from({ length: 3 }, () => {
                const random = Math.random().toString().slice(2, 11);
                return new PaidSession({ phoneNumber: random, cost: 20, handle: random, wallet: { address: `test_addr${random}` }, start: Date.now(), status: 'confirmed' })
            });

            await PaidSessions.addPaidSessions([...paidSessionsPending, ...paidSessionsSubmitted, ...paidSessionsConfirmed]);

            const sessions = await PaidSessions.getByStatus({ statusType: 'pending' });
            expect(sessions.length).toEqual(10);
        });
    });

    describe('updateSessionStatusesByTxId', () => {
        it('should update session statuses by txId', async () => {
            const paidSessionsPending = Array.from({ length: 6 }, (_, i) => {
                const random = Math.random().toString().slice(2, 11);
                const txId = i % 2 == 0 ? `txId1` : `txId${random}`;
                return new PaidSession({ phoneNumber: random, cost: 20, handle: random, wallet: { address: `test_addr${random}` }, start: Date.now(), status: 'pending', txId })
            });

            await PaidSessions.addPaidSessions(paidSessionsPending);

            await PaidSessions.updateSessionStatusesByTxId('txId1', 'confirmed');

            const sessionsAfterUpdate = await PaidSessions.getPaidSessionsUnsafe();
            const confirmedSessions = sessionsAfterUpdate.filter(s => s.status === 'confirmed');
            expect(confirmedSessions).toHaveLength(3);
        });

        it('should make 3 attempts then send to the DLQ', async () => {
            const txId = 'txId12345';
            const paidSessions = [
                new PaidSession({ phoneNumber: '111-111-1111', cost: 20, handle: 'tacos', wallet: { address: 'test_addr1' }, start: Date.now(), status: 'pending', txId }),
            ];

            await PaidSessions.addPaidSessions(paidSessions);

            await PaidSessions.updateSessionStatusesByTxId(txId, 'pending');
            const sessionsAttempt1 = await PaidSessions.getPaidSessionsUnsafe();
            expect(sessionsAttempt1[0].attempts).toEqual(1);

            await PaidSessions.updateSessionStatusesByTxId(txId, 'pending');
            const sessionsAttempt2 = await PaidSessions.getPaidSessionsUnsafe();
            expect(sessionsAttempt2[0].attempts).toEqual(2);

            await PaidSessions.updateSessionStatusesByTxId(txId, 'pending');
            const sessionsAttempt3 = await PaidSessions.getPaidSessionsUnsafe();
            expect(sessionsAttempt3).toHaveLength(0);

            const dlqSessions = await PaidSessions.getDLQPaidSessionsUnsafe();
            expect(dlqSessions.length).toEqual(1);
        });
    });
});