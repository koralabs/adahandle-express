/* eslint-disable @typescript-eslint/ban-ts-comment */
import { UsedAddresses } from '../../../../models/firestore/collections/UsedAddresses';
import * as refunds from "./processRefunds";

jest.mock('../../../../models/firestore/collections/UsedAddresses');

describe('processRefund tests', () => {
    const batchUpdateUsedAddressesSpy = jest.spyOn(UsedAddresses, 'batchUpdateUsedAddresses');
    const refundTransactionsSpy = jest.spyOn(refunds, "refundTransactions");

    afterEach(() => {
        jest.clearAllMocks();
    });

    const paymentAddressFixture: refunds.Refund[] = [{
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
        refundTransactionsSpy.mockResolvedValue("txId");
        await refunds.processRefunds(paymentAddressFixture);

        expect(batchUpdateUsedAddressesSpy).toHaveBeenNthCalledWith(1, [{ "address": "p1", "props": { "status": "processing" } }, { "address": "p2", "props": { "status": "processing" } }]);
        expect(batchUpdateUsedAddressesSpy).toHaveBeenNthCalledWith(2, [{ "address": "p1", "props": { "status": "processed", "txId": "txId" } }, { "address": "p2", "props": { "status": "processed", "txId": "txId" } }]);
        expect(refundTransactionsSpy).toHaveBeenCalledWith({"change": [], "inputs": [{"address": "p1", "amount": {"quantity": 500, "unit": "lovelace"}, "derivation_path": ["1852H"], "id": undefined, "index": undefined}, {"address": "p2", "amount": {"quantity": 10, "unit": "lovelace"}, "derivation_path": ["1852H"], "id": undefined, "index": undefined}], "outputs": [{"address": "r1", "amount": {"quantity": 500, "unit": "lovelace"}}, {"address": "r2", "amount": {"quantity": 10, "unit": "lovelace"}}]});
    });

    it('Should not update to processing if sendPayment does not return an object with an id', async () => {
        refundTransactionsSpy.mockResolvedValue('');

        await refunds.processRefunds([{
            paymentAddress: '0x2',
            returnAddress: {
                address: "return_0x2",
                amount: 500,
                index: undefined,
                txHash: undefined,
              }
        }]);

        expect(batchUpdateUsedAddressesSpy).toHaveBeenCalledTimes(1);
        expect(refundTransactionsSpy).toHaveBeenCalledWith({"change": [], "inputs": [{"address": "0x2", "amount": {"quantity": 500, "unit": "lovelace"}, "derivation_path": ["1852H"], "id": undefined, "index": undefined}], "outputs": [{"address": "return_0x2", "amount": {"quantity": 500, "unit": "lovelace"}}]});
    });
});
