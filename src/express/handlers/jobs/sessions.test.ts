/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Request, Response } from 'express';
import { mocked } from 'ts-jest/utils';
import { checkPayments } from '../../../helpers/graphql';
import { ActiveSession } from '../../../models/ActiveSession';
import { PaidSession } from '../../../models/PaidSession';
import { RefundableSession } from '../../../models/RefundableSession';
import { ActiveSessions } from '../../../models/firestore/collections/ActiveSession';
import { PaidSessions } from '../../../models/firestore/collections/PaidSessions';
import { RefundableSessions } from '../../../models/firestore/collections/RefundableSessions';
import { updateSessionsHandler } from './sessions';


jest.mock('express');
jest.mock('../../../helpers/graphql');
jest.mock('../../../models/firestore/collections/ActiveSession');
jest.mock('../../../models/firestore/collections/PaidSessions');
jest.mock('../../../models/firestore/collections/RefundableSessions');

describe('Job Sessions Tets', () => {
    const refundSpy = jest.spyOn(RefundableSessions, 'addRefundableSessions')
    const paidSpy = jest.spyOn(PaidSessions, 'addPaidSessions')
    const activeRemoveSpy = jest.spyOn(ActiveSessions, 'removeActiveSessions')
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
                phoneNumber: '222-222-2222',
                cost: 50,
                handle: 'expired.unpaid',
                start: expiredDate,
                wallet: { address: 'addr_expired_unpaid' }
            }
        )
    ]
    const PaidSessionFixture = [
        new ActiveSession(
            {
                // full payment
                phoneNumber: '222-222-2222',
                cost: 50,
                handle: 'paid',
                start: unexpiredDate,
                wallet: { address: 'addr_paid' }
            }
        )
    ]
    const RefundableSessionsFixture = [
        new ActiveSession(
            {
                // not expired invalid payment
                phoneNumber: '222-222-2222',
                cost: 50,
                handle: 'invalid',
                start: unexpiredDate,
                wallet: { address: 'addr_invalid_payment' }
            }
        ),
        new ActiveSession(
            {
                // expired and paid
                phoneNumber: '222-222-2222',
                cost: 50,
                handle: 'expired.paid',
                start: expiredDate,
                wallet: { address: 'addr_expired_paid' }
            }
        ),
        new ActiveSession(
            {
                // handle unavailable
                phoneNumber: '222-222-2222',
                cost: 50,
                handle: 'paid',
                start: unexpiredDate,
                wallet: { address: 'addr_handle_unavailable' }
            }
        )
    ]
    const ZeroPaymentFixture = [
        new ActiveSession(
            {
                // zero payment
                phoneNumber: '222-222-2222',
                cost: 50,
                handle: 'zero.payment',
                start: unexpiredDate,
                wallet: { address: 'addr_zero_payment' }
            }
        )
    ]
    const ActiveSessionsFixture = [
        ...UnpaidSessionFixture,
        ...PaidSessionFixture,
        ...RefundableSessionsFixture,
        ...ZeroPaymentFixture
    ]
    const CheckPaymentsFixture = [
        { address: 'expired_unpaid', amount: 0 },
        { address: 'addr_paid', amount: 50 * 1000000 },
        { address: 'addr_invalid_payment', amount: 40 * 1000000 },
        { address: 'addr_expired_paid', amount: 50 * 1000000 },
        { address: 'addr_handle_unavailable', amount: 50 * 1000000 },
        { address: 'addr_zero_payment', amount: 0 }
    ]
    const RefundableWalletsFixture = [
        new RefundableSession({ wallet: { address: 'addr_invalid_payment' }, amount: 40 * 1000000, handle: 'invalid' }),
        new RefundableSession({ wallet: { address: 'addr_expired_paid' }, amount: 50 * 1000000, handle: 'expired.paid' }),
        new RefundableSession({ wallet: { address: 'addr_handle_unavailable' }, amount: 50 * 1000000, handle: 'paid' }),
    ]
    const PaidWalletsFixture = [
        new PaidSession({
            // full payment
            phoneNumber: '222-222-2222',
            cost: 50,
            handle: 'paid',
            wallet: { address: 'addr_paid' },
            start: unexpiredDate
        })
    ]
    describe('updateSessionsHandler tests', () => {

        /**
         * Remove if expired and not paid
         * Refund if not expired but invalid payment
         * Refund if expired and paid
         * Refund if paid sessions already has handle
         * Move to paid if accurate payment and not expired
         * Leave alone if not expired and no payment
         */

        mocked(checkPayments).mockResolvedValue(CheckPaymentsFixture)

        it('should process paid, refunds, and expired sessions correctly', async () => {
            jest.spyOn(ActiveSessions, 'getActiveSessions').mockResolvedValue(ActiveSessionsFixture)

            await updateSessionsHandler(mockRequest as Request, mockResponse as Response);
            expect(activeRemoveSpy).toHaveBeenCalledWith([
                ...UnpaidSessionFixture,
                ...PaidSessionFixture,
                ...RefundableSessionsFixture
            ]);
            expect(refundSpy).toHaveBeenCalledWith(RefundableWalletsFixture);
            expect(paidSpy).toHaveBeenCalledWith(PaidWalletsFixture);
            // If the above number of items were called correctly then 
            // then the last use case should be true which is
            // The zero payment session is left alone
        });

        it('leave unexpired zero payment sessions alone', async () => {
            jest.spyOn(ActiveSessions, 'getActiveSessions').mockResolvedValue([new ActiveSession(
                {
                    // zero payment
                    phoneNumber: '222-222-2222',
                    cost: 50,
                    handle: 'zero.payment',
                    start: unexpiredDate,
                    wallet: { address: 'addr_zero_payment' }
                }
            )])

            await updateSessionsHandler(mockRequest as Request, mockResponse as Response);
            expect(activeRemoveSpy).toHaveBeenCalledWith([]);
            expect(refundSpy).toHaveBeenCalledWith([]);
            expect(paidSpy).toHaveBeenCalledWith([]);
        });
    });
});