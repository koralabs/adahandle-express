import { CreatedBySystem } from "../../../../helpers/constants";
import * as graphql from "../../../../helpers/graphql";
import { toLovelace } from "../../../../helpers/utils";
import { PaidSessions } from "../../../../models/firestore/collections/PaidSessions";
import { UsedAddresses } from "../../../../models/firestore/collections/UsedAddresses";
import { PaidSession } from "../../../../models/PaidSession";

import { verifyRefund } from './verifyRefund';

jest.mock('../../../../helpers/wallet/cardano');
jest.mock('../../../../models/firestore/collections/PaidSessions');
jest.mock('../../../../models/firestore/collections/UsedAddresses');

describe('verifyRefund tests', () => {
    const updateUsedAddressStatusSpy = jest.spyOn(UsedAddresses, 'updateUsedAddressStatus');

    afterEach(() => {
        jest.clearAllMocks();
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
        const refund = await verifyRefund('addr_123');
        expect(refund).toEqual({
            paymentAddress: 'addr_123',
            returnAddress: 'return_123',
            amount: toLovelace(10),
        });

        expect(updateUsedAddressStatusSpy).toHaveBeenCalledTimes(0);
    });

    it('should return null and update usedAddress when totalPayments is 0', async () => {
        jest.spyOn(graphql, 'lookupTransaction').mockResolvedValue({ totalPayments: 0, returnAddress: 'return_123' });
        const refund = await verifyRefund('addr_123');
        expect(refund).toBeNull();
        expect(updateUsedAddressStatusSpy).toHaveBeenCalledTimes(1);
    });

    it('should return null and update usedAddress when returnAddress is undefined', async () => {
        jest.spyOn(graphql, 'lookupTransaction').mockResolvedValue({ totalPayments: 0 });
        const refund = await verifyRefund('addr_123');
        expect(refund).toBeNull();
        expect(updateUsedAddressStatusSpy).toHaveBeenCalledTimes(1);
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
        expect(refund).toBeNull();
        expect(updateUsedAddressStatusSpy).toHaveBeenCalledTimes(1);
    });
});