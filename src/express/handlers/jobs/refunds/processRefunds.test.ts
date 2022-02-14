/* eslint-disable @typescript-eslint/ban-ts-comment */
import { UsedAddresses } from '../../../../models/firestore/collections/UsedAddresses';
import { processRefunds, Refund } from "./processRefunds";

jest.mock('../../../../models/firestore/collections/UsedAddresses');

describe('processRefund tests', () => {
    const batchUpdateUsedAddressesSpy = jest.spyOn(UsedAddresses, 'batchUpdateUsedAddresses');

    afterEach(() => {
        jest.clearAllMocks();
    });

    const paymentAddressFixture: Refund[] = [{
        paymentAddress: 'p1',
        returnAddress: {
            address: "r1",
            amount: 500,
            index: undefined,
            txHash: undefined,
        }
    }, {
        paymentAddress: 'p2',
        returnAddress: {
            address: "r2",
            amount: 10,
            index: undefined,
            txHash: undefined,
        }
    }]

    it('Should send payment and update usedAddress status', async () => {
        const testingCallback = jest.fn(() => {return "txId"});
        await processRefunds(paymentAddressFixture, testingCallback);

        expect(batchUpdateUsedAddressesSpy).toHaveBeenNthCalledWith(1, [{ "address": "p1", "props": { "status": "processing" } }, { "address": "p2", "props": { "status": "processing" } }]);
        expect(batchUpdateUsedAddressesSpy).toHaveBeenNthCalledWith(2, [{ "address": "p1", "props": { "status": "processed", "txId": "txId" } }, { "address": "p2", "props": { "status": "processed", "txId": "txId" } }]);
        expect(testingCallback).toHaveBeenCalledWith({"change": [], "inputs": [{"address": "p1", "amount": {"quantity": 500, "unit": "lovelace"}, "derivation_path": ["1852H"], "id": undefined, "index": undefined}, {"address": "p2", "amount": {"quantity": 10, "unit": "lovelace"}, "derivation_path": ["1852H"], "id": undefined, "index": undefined}], "outputs": [{"address": "r1", "amount": {"quantity": 500, "unit": "lovelace"}}, {"address": "r2", "amount": {"quantity": 10, "unit": "lovelace"}}]});
    });

    it('Should not update to processing if sendPayment does not return an object with an id', async () => {
        const testingCallback = jest.fn(() => {return null});

        await processRefunds([{
            paymentAddress: '0x2',
            returnAddress: {
                address: "return_0x2",
                amount: 500,
                index: undefined,
                txHash: undefined,
              }
        }], testingCallback);

        expect(batchUpdateUsedAddressesSpy).toHaveBeenCalledTimes(1);
        expect(testingCallback).toHaveBeenCalledWith({"change": [], "inputs": [{"address": "0x2", "amount": {"quantity": 500, "unit": "lovelace"}, "derivation_path": ["1852H"], "id": undefined, "index": undefined}], "outputs": [{"address": "return_0x2", "amount": {"quantity": 500, "unit": "lovelace"}}]});
    });
});
