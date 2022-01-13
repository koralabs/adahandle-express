import * as wallet from 'cardano-wallet-js';
import { getRefundWallet } from "./getRefundWallet";
import * as cardano from "../../../../helpers/wallet/cardano";
import { Refund } from './processRefund';

jest.mock('../../../../helpers/wallet/cardano');

describe('getRefundsWallet tests', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    const refundsFixture: Refund[] = [{
        paymentAddress: 'todo',
        returnAddress: 'todo',
        amount: 20
    }, {
        paymentAddress: 'todo',
        returnAddress: 'todo',
        amount: 20
    }]

    it('Should send lock the cron and send notification if there is not enough data', async () => {
        const mockShellyWallet = {
            getTotalBalance: jest.fn(() => 10),
        } as unknown as wallet.ShelleyWallet;
        jest.spyOn(cardano, 'getMintWalletServer').mockResolvedValue(mockShellyWallet);
        expect(getRefundWallet(refundsFixture)).rejects.toThrowError('Balance of 10 is not enough to refund 40!');
    });
});