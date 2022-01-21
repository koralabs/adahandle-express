/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Request, Response } from 'express';
import { mocked } from 'ts-jest/utils';
import { checkPayments } from '../../../helpers/graphql';
import { ActiveSession } from '../../../models/ActiveSession';
import { ActiveSessions } from '../../../models/firestore/collections/ActiveSession';
import { PaidSessions } from '../../../models/firestore/collections/PaidSessions';
import { RefundableSessions } from '../../../models/firestore/collections/RefundableSessions';
import { updateSessionsHandler } from './sessions';
import { StateData } from '../../../models/firestore/collections/StateData';
import { State } from '../../../models/State';
import { CreatedBySystem, SPO_HANDLE_ADA_REFUND_FEE } from '../../../helpers/constants';
import { toLovelace } from '../../../helpers/utils';


jest.mock('express');
jest.mock('../../../helpers/graphql');
jest.mock('../../../models/firestore/collections/ActiveSession');
jest.mock('../../../models/firestore/collections/PaidSessions');
jest.mock('../../../models/firestore/collections/RefundableSessions');
jest.mock('../../../models/firestore/collections/StateData');

describe('Job Sessions Tets', () => {
    const activeRemoveSpy = jest.spyOn(ActiveSessions, 'removeActiveSession')
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
                cost: 50,
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
                cost: 50,
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
                cost: 50,
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
                cost: 50,
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
                cost: 50,
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
                cost: 250,
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
                cost: 50,
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
                cost: 250,
                handle: 'spo.payment',
                start: unexpiredDate,
                paymentAddress: 'addr_spo_payment',
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
        { address: 'addr_paid', amount: 50 * 1000000, returnAddress: 'return_addr_paid' },
        { address: 'addr_invalid_payment', amount: 40 * 1000000, returnAddress: 'return_addr_invalid' },
        { address: 'addr_expired_paid', amount: 50 * 1000000, returnAddress: 'return_addr_expired' },
        { address: 'addr_handle_unavailable', amount: 50 * 1000000, returnAddress: 'return_addr_unavail' },
        { address: 'addr_spo_invalid_payment', amount: 100 * 1000000, returnAddress: 'return_addr_spo_invalid_payment' },
        { address: 'addr_zero_payment', amount: 0, returnAddress: '' },
        { address: 'addr_spo_payment', amount: 250 * 1000000, returnAddress: 'return_addr_spo' }
    ]

    describe('updateSessionsHandler tests', () => {
        it('should return 200 if cron is locked', async () => {
            jest.spyOn(ActiveSessions, 'getActiveSessions').mockResolvedValue(ActiveSessionsFixture);
            jest.spyOn(StateData, 'getStateData').mockResolvedValue(new State({ chainLoad: .77, accessQueueSize: 10, mintingQueueSize: 10, updateActiveSessionsLock: true, totalHandles: 171 }));
            await updateSessionsHandler(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({ "error": false, "message": "Update Sessions cron is locked. Try again later." });
        });

        it('should return no active sessions', async () => {
            jest.spyOn(ActiveSessions, 'getActiveSessions').mockResolvedValue([]);
            jest.spyOn(StateData, 'getStateData').mockResolvedValue(new State({ chainLoad: .77, accessQueueSize: 10, mintingQueueSize: 10, updateActiveSessionsLock: false, totalHandles: 171 }));
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

        mocked(checkPayments).mockResolvedValue(CheckPaymentsFixture)

        it('should process paid, refunds, and expired sessions correctly', async () => {
            jest.spyOn(ActiveSessions, 'getActiveSessions').mockResolvedValue(ActiveSessionsFixture);
            jest.spyOn(StateData, 'getStateData').mockResolvedValue(new State({ chainLoad: .77, accessQueueSize: 10, mintingQueueSize: 10, updateActiveSessionsLock: false, totalHandles: 171 }));

            await updateSessionsHandler(mockRequest as Request, mockResponse as Response);
            expect(activeRemoveSpy).toHaveBeenNthCalledWith(1, PaidSessionFixture[0], PaidSessions.addPaidSession, { ...PaidSessionFixture[0], attempts: 0, dateAdded: expect.any(Number), emailAddress: "", status: 'pending', returnAddress: expect.any(String), createdBySystem: "UI" });
            expect(activeRemoveSpy).toHaveBeenNthCalledWith(2, RefundableSessionsFixture[0], RefundableSessions.addRefundableSession, {
                "amount": CheckPaymentsFixture.find(cp => cp.address === RefundableSessionsFixture[0].paymentAddress)?.amount,
                "handle": RefundableSessionsFixture[0].handle,
                "paymentAddress": RefundableSessionsFixture[0].paymentAddress,
                "createdBySystem": RefundableSessionsFixture[0].createdBySystem,
                "returnAddress": CheckPaymentsFixture.find(cp => cp.address === RefundableSessionsFixture[0].paymentAddress)?.returnAddress
            });
            expect(activeRemoveSpy).toHaveBeenNthCalledWith(3, RefundableSessionsFixture[1], RefundableSessions.addRefundableSession, {
                "amount": CheckPaymentsFixture.find(cp => cp.address === RefundableSessionsFixture[1].paymentAddress)?.amount,
                "handle": RefundableSessionsFixture[1].handle,
                "paymentAddress": RefundableSessionsFixture[1].paymentAddress,
                "createdBySystem": RefundableSessionsFixture[1].createdBySystem,
                "returnAddress": CheckPaymentsFixture.find(cp => cp.address === RefundableSessionsFixture[1].paymentAddress)?.returnAddress
            });
            expect(activeRemoveSpy).toHaveBeenNthCalledWith(4, RefundableSessionsFixture[2], RefundableSessions.addRefundableSession, {
                "amount": CheckPaymentsFixture.find(cp => cp.address === RefundableSessionsFixture[2].paymentAddress)?.amount,
                "handle": RefundableSessionsFixture[2].handle,
                "paymentAddress": RefundableSessionsFixture[2].paymentAddress,
                "createdBySystem": RefundableSessionsFixture[2].createdBySystem,
                "returnAddress": CheckPaymentsFixture.find(cp => cp.address === RefundableSessionsFixture[2].paymentAddress)?.returnAddress
            });
            expect(activeRemoveSpy).toHaveBeenNthCalledWith(5, RefundableSessionsFixture[3], RefundableSessions.addRefundableSession, {
                "amount": Math.max(0, (CheckPaymentsFixture.find(cp => cp.address === RefundableSessionsFixture[3].paymentAddress)?.amount ?? 0) - toLovelace(SPO_HANDLE_ADA_REFUND_FEE)),
                "handle": RefundableSessionsFixture[3].handle,
                "paymentAddress": RefundableSessionsFixture[3].paymentAddress,
                "createdBySystem": RefundableSessionsFixture[3].createdBySystem,
                "returnAddress": CheckPaymentsFixture.find(cp => cp.address === RefundableSessionsFixture[3].paymentAddress)?.returnAddress
            });
            // If the above number of items were called correctly then
            // then the last use case should be true which is
            // The zero payment session is left alone
        });

        it('should remove duplicate active sessions', async () => {
            jest.spyOn(ActiveSessions, 'getActiveSessions').mockResolvedValue([...ActiveSessionsFixture, ...ActiveSessionsFixture]);
            jest.spyOn(StateData, 'getStateData').mockResolvedValue(new State({ chainLoad: .77, accessQueueSize: 10, mintingQueueSize: 10, updateActiveSessionsLock: false, totalHandles: 171 }));

            await updateSessionsHandler(mockRequest as Request, mockResponse as Response);
            expect(activeRemoveSpy).toHaveBeenCalledTimes(5);
        });

        it('leave unexpired zero payment sessions alone', async () => {
            jest.spyOn(ActiveSessions, 'getActiveSessions').mockResolvedValue([new ActiveSession(
                {
                    // zero payment
                    emailAddress: '222-222-2222',
                    cost: 50,
                    handle: 'zero.payment',
                    start: unexpiredDate,
                    paymentAddress: 'addr_zero_payment',
                    createdBySystem: CreatedBySystem.UI
                }
            )])
            jest.spyOn(StateData, 'getStateData').mockResolvedValue(new State({ chainLoad: .77, accessQueueSize: 10, mintingQueueSize: 10, updateActiveSessionsLock: false, totalHandles: 171 }));

            await updateSessionsHandler(mockRequest as Request, mockResponse as Response);
            expect(activeRemoveSpy).toHaveBeenCalledTimes(0);
        });
    });
});
