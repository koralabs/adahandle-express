/* eslint-disable @typescript-eslint/ban-ts-comment */
import * as wallet from 'cardano-wallet-js';

import { UsedAddresses } from '../../../../models/firestore/collections/UsedAddresses';
import { UsedAddressStatus } from '../../../../models/UsedAddress';
import { processRefund } from "./processRefund";

jest.mock('../../../../models/firestore/collections/UsedAddresses');

describe('processRefund tests', () => {

    const updateUsedAddressStatusSpy = jest.spyOn(UsedAddresses, 'updateUsedAddressStatus');

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('Should send payment and update usedAddress status', async () => {
        const mockSendPayment = jest.fn(() => ({ id: 'txId' }));
        const mockWallet = {
            sendPayment: mockSendPayment
        }

        const paymentAddress = '0x2';
        const returnAddress = 'return_0x2';
        const amount = 500;

        await processRefund({
            paymentAddress,
            returnAddress,
            amount
        }, mockWallet as unknown as wallet.ShelleyWallet);

        expect(updateUsedAddressStatusSpy).toHaveBeenNthCalledWith(1, paymentAddress, UsedAddressStatus.PROCESSING);
        expect(updateUsedAddressStatusSpy).toHaveBeenNthCalledWith(2, paymentAddress, UsedAddressStatus.PROCESSED);
        expect(mockSendPayment).toHaveBeenCalledWith(undefined, [{ "id": returnAddress, "state": "unused" }], [amount]);
    });

    it('Should not update to processing if sendPayment does not return an object with an id', async () => {
        const mockSendPayment = jest.fn(() => ({ burrito: 'taco' }));
        const mockWallet = {
            sendPayment: mockSendPayment
        }

        await processRefund({
            paymentAddress: '0x2',
            returnAddress: 'return_0x2',
            amount: 500
        }, mockWallet as unknown as wallet.ShelleyWallet);

        expect(updateUsedAddressStatusSpy).toHaveBeenCalledTimes(1);
        expect(mockSendPayment).toHaveBeenCalledTimes(1);
    });
});
