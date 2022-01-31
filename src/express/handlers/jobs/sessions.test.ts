/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Request, Response } from 'express';
import * as graphql from '../../../helpers/graphql';
import { ActiveSession, ActiveSessionStatus } from '../../../models/ActiveSession';
import { ActiveSessions } from '../../../models/firestore/collections/ActiveSession';
import { updateSessionsHandler } from './sessions';
import { StateData } from '../../../models/firestore/collections/StateData';
import { State } from '../../../models/State';
import { CreatedBySystem } from '../../../helpers/constants';
import { toLovelace } from '../../../helpers/utils';
import { StakePools } from '../../../models/firestore/collections/StakePools';


jest.mock('express');
jest.mock('../../../helpers/graphql');
jest.mock('../../../models/firestore/collections/ActiveSession');
jest.mock('../../../models/firestore/collections/StateData');
jest.mock('../../../models/firestore/collections/StakePools');

describe('Job Sessions Tets', () => {
    const updateStatusForSessionsSpy = jest.spyOn(ActiveSessions, 'updateSessions')
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;

    beforeEach(() => {
        mockRequest = {};
        mockResponse = {
            // @ts-ignore
            status: jest.fn(() => mockResponse),
            json: jest.fn()
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    const expiredDate = new Date().setMinutes(new Date().getMinutes() - 11);
    const unexpiredDate = new Date().setMinutes(new Date().getMinutes() - 1);
    const UnpaidSessionFixture = [
        new ActiveSession(
            {
                // expired not paid
                emailAddress: '222-222-2222',
                cost: toLovelace(50),
                handle: 'expired.unpaid',
                start: expiredDate,
                paymentAddress: 'addr_expired_unpaid',
                createdBySystem: CreatedBySystem.UI
            }
        )
    ]
    const PaidSessionFixture = [
        new ActiveSession(
            {
                // full payment
                emailAddress: '222-222-2222',
                cost: toLovelace(50),
                handle: 'paid',
                start: unexpiredDate,
                paymentAddress: 'addr_paid',
                createdBySystem: CreatedBySystem.UI
            }
        )
    ]
    const RefundableSessionsFixture = [
        new ActiveSession(
            {
                // not expired invalid payment
                emailAddress: '222-222-2222',
                cost: toLovelace(50),
                handle: 'invalid',
                start: unexpiredDate,
                paymentAddress: 'addr_invalid_payment',
                createdBySystem: CreatedBySystem.UI
            }
        ),
        new ActiveSession(
            {
                // expired and paid
                emailAddress: '222-222-2222',
                cost: toLovelace(50),
                handle: 'expired.paid',
                start: expiredDate,
                paymentAddress: 'addr_expired_paid',
                createdBySystem: CreatedBySystem.UI
            }
        ),
        new ActiveSession(
            {
                // handle unavailable
                emailAddress: '222-222-2222',
                cost: toLovelace(50),
                handle: 'paid',
                start: unexpiredDate,
                paymentAddress: 'addr_handle_unavailable',
                createdBySystem: CreatedBySystem.UI
            }
        ),
        new ActiveSession(
            {
                // handle unavailable
                emailAddress: '222-222-2222',
                cost: toLovelace(250),
                handle: 'paid',
                start: unexpiredDate,
                paymentAddress: 'addr_spo_invalid_payment',
                createdBySystem: CreatedBySystem.SPO
            }
        )
    ]
    const ZeroPaymentFixture = [
        new ActiveSession(
            {
                // zero payment
                emailAddress: '222-222-2222',
                cost: toLovelace(50),
                handle: 'zero.payment',
                start: unexpiredDate,
                paymentAddress: 'addr_zero_payment',
                createdBySystem: CreatedBySystem.UI
            }
        )
    ]

    const SPOSessionFixture = [
        new ActiveSession(
            {
                // zero payment
                emailAddress: '222-222-2222',
                cost: toLovelace(250),
                handle: 'spo.payment',
                start: unexpiredDate,
                paymentAddress: 'addr_spo_payment',
                createdBySystem: CreatedBySystem.SPO
            }
        ),
        new ActiveSession(
            {
                // zero payment
                emailAddress: '222-222-2222',
                cost: toLovelace(250),
                handle: 'spo.not.owner',
                start: unexpiredDate,
                paymentAddress: 'addr_spo_not_owner',
                createdBySystem: CreatedBySystem.SPO
            }
        )
    ]

    const ActiveSessionsFixture = [
        ...UnpaidSessionFixture,
        ...PaidSessionFixture,
        ...RefundableSessionsFixture,
        ...ZeroPaymentFixture,
        ...SPOSessionFixture
    ]

    const CheckPaymentsFixture = [
        { address: 'expired_unpaid', amount: 0, returnAddress: '' },
        { address: 'addr_paid', amount: toLovelace(50), returnAddress: 'return_addr_paid' },
        { address: 'addr_invalid_payment', amount: toLovelace(40), returnAddress: 'return_addr_invalid' },
        { address: 'addr_expired_paid', amount: toLovelace(50), returnAddress: 'return_addr_expired' },
        { address: 'addr_handle_unavailable', amount: toLovelace(50), returnAddress: 'return_addr_unavail' },
        { address: 'addr_spo_invalid_payment', amount: toLovelace(100), returnAddress: 'return_addr_spo_invalid_payment' },
        { address: 'addr_zero_payment', amount: 0, returnAddress: '' },
        { address: 'addr_spo_payment', amount: toLovelace(250), returnAddress: 'return_addr_spo' },
        { address: 'addr_spo_not_owner', amount: toLovelace(250), returnAddress: 'return_addr_spo_not_owner' }
    ]

    describe('updateSessionsHandler tests', () => {
        it('should return 200 if cron is locked', async () => {
            jest.spyOn(ActiveSessions, 'getActiveSessions').mockResolvedValue(ActiveSessionsFixture);
            jest.spyOn(StateData, 'getStateData').mockResolvedValue(new State({ chainLoad: .77, accessQueueSize: 10, mintingQueueSize: 10, updateActiveSessionsLock: true, totalHandles: 171 }));
            jest.spyOn(StateData, 'checkAndLockCron').mockResolvedValue(false);
            await updateSessionsHandler(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({ "error": false, "message": "Update Sessions cron is locked. Try again later." });
        });

        it('should return no active sessions', async () => {
            jest.spyOn(ActiveSessions, 'getActiveSessions').mockResolvedValue([]);
            jest.spyOn(StateData, 'getStateData').mockResolvedValue(new State({ chainLoad: .77, accessQueueSize: 10, mintingQueueSize: 10, updateActiveSessionsLock: false, totalHandles: 171 }));
            jest.spyOn(StateData, 'checkAndLockCron').mockResolvedValue(true);
            await updateSessionsHandler(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({ "error": false, "message": "No active sessions!" });
        });

        /**
         * Remove if expired and not paid
         * Refund if not expired but invalid payment
         * Refund if expired and paid
         * Refund if paid sessions already has handle
         * Refund SPO and charge fee
         * Move to paid if accurate payment and not expired
         * Leave alone if not expired and no payment
         */

        jest.spyOn(graphql, 'checkPayments').mockResolvedValue(CheckPaymentsFixture)

        it('should process paid, refunds, and expired sessions correctly', async () => {
            jest.spyOn(ActiveSessions, 'getActiveSessions').mockResolvedValue(ActiveSessionsFixture);
            jest.spyOn(StateData, 'getStateData').mockResolvedValue(new State({ chainLoad: .77, accessQueueSize: 10, mintingQueueSize: 10, updateActiveSessionsLock: false, totalHandles: 171 }));
            jest.spyOn(StateData, 'checkAndLockCron').mockResolvedValue(true);
            jest.spyOn(StakePools, 'verifyReturnAddressOwnsStakePool').mockResolvedValueOnce(true).mockResolvedValueOnce(false);

            await updateSessionsHandler(mockRequest as Request, mockResponse as Response);
            expect(updateStatusForSessionsSpy).toHaveBeenCalledTimes(8);
            expect(updateStatusForSessionsSpy).toHaveBeenNthCalledWith(1, [{ ...UnpaidSessionFixture[0], dateAdded: expect.any(Number), emailAddress: "", refundAmount: 0, returnAddress: expect.any(String), status: ActiveSessionStatus.REFUNDABLE_PENDING }]);
            expect(updateStatusForSessionsSpy).toHaveBeenNthCalledWith(2, [{ ...PaidSessionFixture[0], dateAdded: expect.any(Number), emailAddress: "", returnAddress: expect.any(String), status: ActiveSessionStatus.PAID_PENDING }]);
            expect(updateStatusForSessionsSpy).toHaveBeenNthCalledWith(3, [{ ...RefundableSessionsFixture[0], dateAdded: expect.any(Number), emailAddress: "", refundAmount: toLovelace(40), returnAddress: expect.any(String), status: ActiveSessionStatus.REFUNDABLE_PENDING }]);
            expect(updateStatusForSessionsSpy).toHaveBeenNthCalledWith(4, [{ ...RefundableSessionsFixture[1], dateAdded: expect.any(Number), emailAddress: "", refundAmount: toLovelace(50), returnAddress: expect.any(String), status: ActiveSessionStatus.REFUNDABLE_PENDING }]);
            expect(updateStatusForSessionsSpy).toHaveBeenNthCalledWith(5, [{ ...RefundableSessionsFixture[2], dateAdded: expect.any(Number), emailAddress: "", refundAmount: toLovelace(50), returnAddress: expect.any(String), status: ActiveSessionStatus.REFUNDABLE_PENDING }]);
            expect(updateStatusForSessionsSpy).toHaveBeenNthCalledWith(6, [{ ...RefundableSessionsFixture[3], dateAdded: expect.any(Number), emailAddress: "", refundAmount: toLovelace(50), returnAddress: expect.any(String), status: ActiveSessionStatus.REFUNDABLE_PENDING }]);

            // since the 7th item is a 0 payment session, it should skip and be left alone

            expect(updateStatusForSessionsSpy).toHaveBeenNthCalledWith(7, [{ ...SPOSessionFixture[0], dateAdded: expect.any(Number), emailAddress: "", returnAddress: expect.any(String), status: ActiveSessionStatus.PAID_PENDING }]);
            expect(updateStatusForSessionsSpy).toHaveBeenNthCalledWith(8, [{ ...SPOSessionFixture[1], dateAdded: expect.any(Number), emailAddress: "", refundAmount: toLovelace(200), returnAddress: expect.any(String), status: ActiveSessionStatus.REFUNDABLE_PENDING }]);
            // If the above number of items were called correctly then
            // then the last use case should be true which is
            // The zero payment session is left alone
        });

        it('should remove duplicate active sessions', async () => {
            jest.spyOn(ActiveSessions, 'getActiveSessions').mockResolvedValue([...ActiveSessionsFixture, ...ActiveSessionsFixture]);
            jest.spyOn(StateData, 'getStateData').mockResolvedValue(new State({ chainLoad: .77, accessQueueSize: 10, mintingQueueSize: 10, updateActiveSessionsLock: false, totalHandles: 171 }));
            jest.spyOn(StateData, 'checkAndLockCron').mockResolvedValue(true);

            await updateSessionsHandler(mockRequest as Request, mockResponse as Response);
            expect(updateStatusForSessionsSpy).toHaveBeenCalledTimes(8);
        });

        it('leave unexpired zero payment sessions alone', async () => {
            jest.spyOn(ActiveSessions, 'getActiveSessions').mockResolvedValue([new ActiveSession(
                {
                    // zero payment
                    emailAddress: '222-222-2222',
                    cost: toLovelace(50),
                    handle: 'zero.payment',
                    start: unexpiredDate,
                    paymentAddress: 'addr_zero_payment',
                    createdBySystem: CreatedBySystem.UI
                }
            )])
            jest.spyOn(StateData, 'getStateData').mockResolvedValue(new State({ chainLoad: .77, accessQueueSize: 10, mintingQueueSize: 10, updateActiveSessionsLock: false, totalHandles: 171 }));
            jest.spyOn(StateData, 'checkAndLockCron').mockResolvedValue(true);

            await updateSessionsHandler(mockRequest as Request, mockResponse as Response);
            expect(updateStatusForSessionsSpy).toHaveBeenCalledTimes(0);
        });
    });
});
