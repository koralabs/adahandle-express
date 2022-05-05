import { CreatedBySystem } from "../../../../helpers/constants";
import * as graphql from "../../../../helpers/graphql";
import { toLovelace } from "../../../../helpers/utils";
import { ActiveSession } from "../../../../models/ActiveSession";
import { ActiveSessions } from "../../../../models/firestore/collections/ActiveSession";

import { verifyRefund } from './verifyRefund';

jest.mock('../../../../helpers/wallet/cardano');
jest.mock('../../../../models/firestore/collections/StakePools');
jest.mock('../../../../models/firestore/collections/ActiveSession');

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
        jest.spyOn(ActiveSessions, 'getByPaymentAddress').mockResolvedValue(new ActiveSession({
            emailAddress: "",
            cost: toLovelace(10),
            handle: "",
            start: 0,
            attempts: 0,
            paymentAddress: 'addr_123',
            returnAddress: 'return_123',
            createdBySystem: CreatedBySystem.UI
        }));
        const refund = await verifyRefund('addr_123');
        expect(refund).toEqual({
            refund: {
                paymentAddress: 'addr_123',
                returnAddress: {
                    address: "return_123",
                    amount: toLovelace(10),
                    index: undefined,
                    txHash: undefined,
                }
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
        jest.spyOn(ActiveSessions, 'getByPaymentAddress').mockResolvedValue(new ActiveSession({
            emailAddress: "",
            cost: toLovelace(10),
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
});