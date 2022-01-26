import { CreatedBySystem } from "../../../../helpers/constants";
import * as graphql from "../../../../helpers/graphql";
import { toLovelace } from "../../../../helpers/utils";
import { PaidSessions } from "../../../../models/firestore/collections/PaidSessions";
import { RefundableSessions } from "../../../../models/firestore/collections/RefundableSessions";
import { StakePools } from "../../../../models/firestore/collections/StakePools";
import { PaidSession } from "../../../../models/PaidSession";
import { RefundableSession } from "../../../../models/RefundableSession";

import { verifyRefund } from './verifyRefund';

jest.mock('../../../../helpers/wallet/cardano');
jest.mock('../../../../models/firestore/collections/PaidSessions');
jest.mock('../../../../models/firestore/collections/StakePools');
jest.mock('../../../../models/firestore/collections/RefundableSessions');

describe('verifyRefund tests', () => {

    afterEach(() => {
        jest.clearAllMocks();
        jest.resetAllMocks();
    });

    it('should return null if transaction fails', async () => {
        jest.spyOn(graphql, 'lookupTransaction').mockRejectedValue(null);
        const refund = await verifyRefund('addr_123');
        expect(refund).toBeNull();
    });

    it('Should return refund', async () => {
        jest.spyOn(graphql, 'lookupTransaction').mockResolvedValue({ totalPayments: toLovelace(20), returnAddress: 'return_123' });
        jest.spyOn(PaidSessions, 'getPaidSessionByWalletAddress').mockResolvedValue(new PaidSession({
            emailAddress: "",
            cost: 10,
            handle: "",
            start: 0,
            attempts: 0,
            paymentAddress: 'addr_123',
            returnAddress: 'return_123',
            createdBySystem: CreatedBySystem.UI
        }));
        jest.spyOn(RefundableSessions, 'getRefundableSessionByWalletAddress').mockResolvedValue(null);
        const refund = await verifyRefund('addr_123');
        expect(refund).toEqual({
            refund: {
                paymentAddress: 'addr_123',
                returnAddress: 'return_123',
                amount: toLovelace(10),
            }
        });
    });

    it('should return null and update usedAddress when totalPayments is 0', async () => {
        jest.spyOn(graphql, 'lookupTransaction').mockResolvedValue({ totalPayments: 0, returnAddress: 'return_123' });
        const refund = await verifyRefund('addr_123');
        expect(refund).toEqual({ "status": "processed" })
    });

    it('should return null and update usedAddress when returnAddress is undefined', async () => {
        jest.spyOn(graphql, 'lookupTransaction').mockResolvedValue({ totalPayments: 2 });
        const refund = await verifyRefund('addr_123');
        expect(refund).toEqual({ "status": "bad_state" })
    });

    it('should return null when paymentAddress cost and totalPayments match', async () => {
        jest.spyOn(graphql, 'lookupTransaction').mockResolvedValue({ totalPayments: toLovelace(10), returnAddress: 'return_123' });
        jest.spyOn(PaidSessions, 'getPaidSessionByWalletAddress').mockResolvedValue(new PaidSession({
            emailAddress: "",
            cost: 10,
            handle: "",
            start: 0,
            attempts: 0,
            paymentAddress: 'addr_123',
            returnAddress: 'return_123',
            createdBySystem: CreatedBySystem.UI
        }));

        const refund = await verifyRefund('addr_123');
        expect(refund).toEqual({ status: "processed" });
    });

    describe('SPO tests', () => {

        it('Should not return refund when the SPO is the owner', async () => {
            jest.spyOn(graphql, 'lookupTransaction').mockResolvedValue({ totalPayments: toLovelace(250), returnAddress: 'return_123' });
            jest.spyOn(PaidSessions, 'getPaidSessionByWalletAddress').mockResolvedValue(new PaidSession({
                emailAddress: "",
                cost: 250,
                handle: "",
                start: 0,
                attempts: 0,
                paymentAddress: 'addr_123',
                returnAddress: 'return_123',
                createdBySystem: CreatedBySystem.SPO
            }));
            jest.spyOn(StakePools, 'verifyReturnAddressOwnsStakePool').mockResolvedValue(true);

            const refund = await verifyRefund('addr_123');
            expect(refund).toEqual({ status: "processed" });
        });

        it('Should return refund with a fee deducted if payment is from an SPO and payment is the correct amount and is not the owner', async () => {
            jest.spyOn(graphql, 'lookupTransaction').mockResolvedValue({ totalPayments: toLovelace(250), returnAddress: 'return_123' });
            jest.spyOn(RefundableSessions, 'getRefundableSessionByWalletAddress').mockResolvedValue(new RefundableSession({
                amount: 250,
                handle: "",
                paymentAddress: 'addr_123',
                returnAddress: 'return_123',
                createdBySystem: CreatedBySystem.SPO
            }));
            jest.spyOn(StakePools, 'verifyReturnAddressOwnsStakePool').mockResolvedValue(false);

            const refund = await verifyRefund('addr_123');
            expect(refund).toEqual({
                refund: {
                    paymentAddress: 'addr_123',
                    returnAddress: 'return_123',
                    amount: toLovelace(200),
                }
            });
        });

        it('Should return refund with a fee deducted if payment is incorrect', async () => {
            jest.spyOn(graphql, 'lookupTransaction').mockResolvedValue({ totalPayments: toLovelace(200), returnAddress: 'return_123' });
            jest.spyOn(RefundableSessions, 'getRefundableSessionByWalletAddress').mockResolvedValue(new RefundableSession({
                amount: 250,
                handle: "",
                paymentAddress: 'addr_123',
                returnAddress: 'return_123',
                createdBySystem: CreatedBySystem.SPO
            }));
            jest.spyOn(StakePools, 'verifyReturnAddressOwnsStakePool').mockResolvedValue(false);

            const refund = await verifyRefund('addr_123');
            expect(refund).toEqual({
                refund: {
                    paymentAddress: 'addr_123',
                    returnAddress: 'return_123',
                    amount: toLovelace(150),
                }
            });
        });

        it('Should not return refund if the payment is less than the deducted fee', async () => {
            jest.spyOn(graphql, 'lookupTransaction').mockResolvedValue({ totalPayments: toLovelace(50), returnAddress: 'return_123' });
            jest.spyOn(PaidSessions, 'getPaidSessionByWalletAddress').mockResolvedValue(new PaidSession({
                emailAddress: "",
                cost: 250,
                handle: "",
                start: 0,
                attempts: 0,
                paymentAddress: 'addr_123',
                returnAddress: 'return_123',
                createdBySystem: CreatedBySystem.SPO
            }));
            jest.spyOn(StakePools, 'verifyReturnAddressOwnsStakePool').mockResolvedValue(false);

            const refund = await verifyRefund('addr_123');
            expect(refund).toEqual({ status: "processed" });
        });
    });
});