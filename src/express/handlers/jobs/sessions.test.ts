/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Request, Response } from 'express';
import * as graphql from '../../../helpers/graphql';
import { ActiveSession, Status, WorkflowStatus } from '../../../models/ActiveSession';
import { ActiveSessions } from '../../../models/firestore/collections/ActiveSession';
import { updateSessionsHandler } from './sessions';
import { StateData } from '../../../models/firestore/collections/StateData';
import { CreatedBySystem } from '../../../helpers/constants';
import { toLovelace } from '../../../helpers/utils';
import { StakePools } from '../../../models/firestore/collections/StakePools';
import * as StateFixtures from "../../../tests/stateFixture";
import { CronState } from '../../../models/State';


jest.mock('express');
jest.mock('../../../helpers/graphql');
jest.mock('../../../models/firestore/collections/ActiveSession');
jest.mock('../../../models/firestore/collections/StakePools');
StateFixtures.setupStateFixtures();

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

    const paymentWindowTimeoutMinutes = 60
    const expiredDate = new Date().setMilliseconds(new Date().getMilliseconds() - ((paymentWindowTimeoutMinutes + 1) * 60 * 1000));
    const unexpiredDate = new Date().setMinutes(new Date().getMinutes() - 1);

    const UnpaidSessionFixture = [
        new ActiveSession(
            {
                // expired not paid
                emailAddress: '222-222-2222',
                cost: toLovelace(50),
                handle: 'expired.unpaid',
                start: expiredDate,
                paymentAddress: 'addr_test1expired_unpaid',
                createdBySystem: CreatedBySystem.UI,
                returnAddress: ""
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
                paymentAddress: 'addr_test1paid',
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
                paymentAddress: 'addr_test1invalid_payment',
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
                paymentAddress: 'addr_test1expired_paid',
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
                paymentAddress: 'addr_test1handle_unavailable',
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
                paymentAddress: 'addr_test1spo_invalid_payment',
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
                paymentAddress: 'addr_test1zero_payment',
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
                paymentAddress: 'addr_test1spo_payment',
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
                paymentAddress: 'addr_test1spo_not_owner',
                createdBySystem: CreatedBySystem.SPO
            }
        )
    ]

    const ByronSessionFixture = [
        new ActiveSession(
            {
                // full payment
                emailAddress: '222-222-2222',
                cost: toLovelace(50),
                handle: 'paid',
                start: unexpiredDate,
                paymentAddress: 'byron_paid',
                createdBySystem: CreatedBySystem.UI
            }
        )
    ]

    const ActiveSessionsFixture = [
        ...UnpaidSessionFixture,
        ...PaidSessionFixture,
        ...RefundableSessionsFixture,
        ...ZeroPaymentFixture,
        ...ByronSessionFixture,
        ...SPOSessionFixture
    ]

    const CheckPaymentsFixture = [
        { address: '', amount: 0, paymentAddress: 'addr_test1expired_unpaid', txHash: '', index: 0 },
        { address: 'addr_test1_returnpaid', amount: toLovelace(50), paymentAddress: 'addr_test1paid', txHash: '', index: 0 },
        { address: 'addr_test1_returninvalid', amount: toLovelace(40), paymentAddress: 'addr_test1invalid_payment', txHash: '', index: 0 },
        { address: 'addr_test1_returnexpired', amount: toLovelace(50), paymentAddress: 'addr_test1expired_paid', txHash: '', index: 0 },
        { address: 'addr_test1_returnunavail', amount: toLovelace(50), paymentAddress: 'addr_test1handle_unavailable', txHash: '', index: 0 },
        { address: 'addr_test1_returnspo_invalid_payment', amount: toLovelace(100), paymentAddress: 'addr_test1spo_invalid_payment', txHash: '', index: 0 },
        { address: '', amount: 0, paymentAddress: 'addr_test1zero_payment', txHash: '', index: 0 },
        { address: 'byron_paid_return', amount: toLovelace(50), paymentAddress: 'byron_paid', txHash: '', index: 0 },
        { address: 'addr_test1_returnspo', amount: toLovelace(250), paymentAddress: 'addr_test1spo_payment', txHash: '', index: 0 },
        { address: 'addr_test1_returnspo_not_owner', amount: toLovelace(250), paymentAddress: 'addr_test1spo_not_owner', txHash: '', index: 0 }
    ]

    describe('updateSessionsHandler tests', () => {
        it('should return 200 if cron is locked', async () => {
            jest.spyOn(ActiveSessions, 'getPendingActiveSessions').mockResolvedValue(ActiveSessionsFixture);
            StateFixtures.state.updateActiveSessionsLock = CronState.EXECUTING;
            jest.spyOn(StateData, 'checkAndLockCron').mockResolvedValue(false);
            await updateSessionsHandler(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({ "error": false, "message": "Update Sessions cron is locked. Try again later." });
        });

        it('should return no active sessions', async () => {
            jest.spyOn(ActiveSessions, 'getPendingActiveSessions').mockResolvedValue([]);
            StateFixtures.state.updateActiveSessionsLock = CronState.UNLOCKED;
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
            jest.spyOn(ActiveSessions, 'getPendingActiveSessions').mockResolvedValue(ActiveSessionsFixture);
            jest.spyOn(StakePools, 'verifyReturnAddressOwnsStakePool').mockResolvedValueOnce(true).mockResolvedValueOnce(false);

            await updateSessionsHandler(mockRequest as Request, mockResponse as Response);
            expect(updateStatusForSessionsSpy).toHaveBeenCalledTimes(9);
            expect(updateStatusForSessionsSpy).toHaveBeenNthCalledWith(1, [{ ...UnpaidSessionFixture[0], dateAdded: expect.any(Number), emailAddress: "", refundAmount: 0, returnAddress: expect.any(String), txHash: '', index: 0, status: Status.REFUNDABLE, workflowStatus: WorkflowStatus.PENDING }]);
            expect(updateStatusForSessionsSpy).toHaveBeenNthCalledWith(2, [{ ...PaidSessionFixture[0], dateAdded: expect.any(Number), emailAddress: "", returnAddress: expect.any(String), txHash: '', index: 0, status: Status.PAID, workflowStatus: WorkflowStatus.PENDING }]);
            expect(updateStatusForSessionsSpy).toHaveBeenNthCalledWith(3, [{ ...RefundableSessionsFixture[0], dateAdded: expect.any(Number), emailAddress: "", refundAmount: toLovelace(40), returnAddress: expect.any(String), txHash: '', index: 0, status: Status.REFUNDABLE, workflowStatus: WorkflowStatus.PENDING }]);
            expect(updateStatusForSessionsSpy).toHaveBeenNthCalledWith(4, [{ ...RefundableSessionsFixture[1], dateAdded: expect.any(Number), emailAddress: "", refundAmount: toLovelace(50), returnAddress: expect.any(String), txHash: '', index: 0, status: Status.REFUNDABLE, workflowStatus: WorkflowStatus.PENDING }]);
            expect(updateStatusForSessionsSpy).toHaveBeenNthCalledWith(5, [{ ...RefundableSessionsFixture[2], dateAdded: expect.any(Number), emailAddress: "", refundAmount: toLovelace(50), returnAddress: expect.any(String), txHash: '', index: 0, status: Status.REFUNDABLE, workflowStatus: WorkflowStatus.PENDING }]);
            expect(updateStatusForSessionsSpy).toHaveBeenNthCalledWith(6, [{ ...RefundableSessionsFixture[3], dateAdded: expect.any(Number), emailAddress: "", refundAmount: toLovelace(50), returnAddress: expect.any(String), txHash: '', index: 0, status: Status.REFUNDABLE, workflowStatus: WorkflowStatus.PENDING }]);

            // since the 7th item is a 0 payment session, it should skip and be left alone

            expect(updateStatusForSessionsSpy).toHaveBeenNthCalledWith(7, [{ ...ByronSessionFixture[0], dateAdded: expect.any(Number), emailAddress: "", refundAmount: toLovelace(50), returnAddress: expect.any(String), txHash: '', index: 0, status: Status.REFUNDABLE, workflowStatus: WorkflowStatus.PENDING }]);
            expect(updateStatusForSessionsSpy).toHaveBeenNthCalledWith(8, [{ ...SPOSessionFixture[0], dateAdded: expect.any(Number), emailAddress: "", returnAddress: expect.any(String), txHash: '', index: 0, status: Status.PAID, workflowStatus: WorkflowStatus.PENDING }]);
            expect(updateStatusForSessionsSpy).toHaveBeenNthCalledWith(9, [{ ...SPOSessionFixture[1], dateAdded: expect.any(Number), emailAddress: "", refundAmount: toLovelace(200), returnAddress: expect.any(String), txHash: '', index: 0, status: Status.REFUNDABLE, workflowStatus: WorkflowStatus.PENDING }]);

            // If the above number of items were called correctly then
            // then the last use case should be true which is
            // The zero payment session is left alone
        });

        it('should remove duplicate active sessions', async () => {
            jest.spyOn(ActiveSessions, 'getPendingActiveSessions').mockResolvedValue([...ActiveSessionsFixture, ...ActiveSessionsFixture]);

            await updateSessionsHandler(mockRequest as Request, mockResponse as Response);
            expect(updateStatusForSessionsSpy).toHaveBeenCalledTimes(9);
        });

        it('leave unexpired zero payment sessions alone', async () => {
            jest.spyOn(ActiveSessions, 'getPendingActiveSessions').mockResolvedValue([new ActiveSession(
                {
                    // zero payment
                    emailAddress: '222-222-2222',
                    cost: toLovelace(50),
                    handle: 'zero.payment',
                    start: unexpiredDate,
                    paymentAddress: 'addr_test1zero_payment',
                    createdBySystem: CreatedBySystem.UI
                }
            )])

            await updateSessionsHandler(mockRequest as Request, mockResponse as Response);
            expect(updateStatusForSessionsSpy).toHaveBeenCalledTimes(0);
        });
    });
});
