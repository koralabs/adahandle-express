/* eslint-disable @typescript-eslint/ban-ts-comment */
import * as wallet from 'cardano-wallet-js';

import { UsedAddresses } from '../../../../models/firestore/collections/UsedAddresses';
import { UsedAddressStatus } from '../../../../models/UsedAddress';
import { processRefunds, Refund } from "./processRefunds";

jest.mock('../../../../models/firestore/collections/UsedAddresses');

describe('processRefund tests', () => {
    const batchUpdateUsedAddressesSpy = jest.spyOn(UsedAddresses, 'batchUpdateUsedAddresses');

    afterEach(() => {
        jest.clearAllMocks();
    });

    const paymentAddressFixture: Refund[] = [{
        paymentAddress: 'p1',
        returnAddress: 'r1',
        amount: 500
    }, {
        paymentAddress: 'p2',
        returnAddress: 'r2',
        amount: 10
    }]

    it('Should send payment and update usedAddress status', async () => {
        const id = 'txId'
        const mockSendPayment = jest.fn(() => ({ id }));
        const mockWallet = {
            sendPayment: mockSendPayment
        }

        await processRefunds(paymentAddressFixture, mockWallet as unknown as wallet.ShelleyWallet);

        expect(batchUpdateUsedAddressesSpy).toHaveBeenNthCalledWith(1, [{ "address": "p1", "props": { "status": "processing" } }, { "address": "p2", "props": { "status": "processing" } }]);
        expect(batchUpdateUsedAddressesSpy).toHaveBeenNthCalledWith(2, [{ "address": "p1", "props": { "status": "processed", "txId": "txId" } }, { "address": "p2", "props": { "status": "processed", "txId": "txId" } }]);
        expect(mockSendPayment).toHaveBeenCalledWith(undefined, [{ "id": "r1", "state": "unused" }, { "id": "r2", "state": "unused" }], [500, 10]);
    });

    it('Should not update to processing if sendPayment does not return an object with an id', async () => {
        const mockSendPayment = jest.fn(() => ({ burrito: 'taco' }));
        const mockWallet = {
            sendPayment: mockSendPayment
        }

        await processRefunds([{
            paymentAddress: '0x2',
            returnAddress: 'return_0x2',
            amount: 500
        }], mockWallet as unknown as wallet.ShelleyWallet);

        expect(batchUpdateUsedAddressesSpy).toHaveBeenCalledTimes(1);
        expect(mockSendPayment).toHaveBeenCalledTimes(1);
    });
});
