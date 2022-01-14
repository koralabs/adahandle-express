import * as wallet from 'cardano-wallet-js';
import { checkWalletBalance } from "./checkWalletBalance";
import { Refund } from './processRefunds';

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

    it('Should lock the cron and send notification if there is not enough data', async () => {
        const mockShellyWallet = {
            getTotalBalance: jest.fn(() => 10),
        } as unknown as wallet.ShelleyWallet;
        expect(checkWalletBalance(refundsFixture, mockShellyWallet)).rejects.toThrowError('Balance of 10 is not enough to refund 40!');
    });
});