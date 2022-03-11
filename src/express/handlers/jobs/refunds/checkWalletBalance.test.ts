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
        returnAddress: {
            address: "todo",
            amount: 20,
            index: undefined,
            txHash: undefined,
          }
    }, {
        paymentAddress: 'todo',
        returnAddress: {
            address: "todo",
            amount: 20,
            index: undefined,
            txHash: undefined,
          }
    }]

    it('Should lock the cron and send notification if there is not enough data', async () => {
        const mockShellyWallet = {
            getAvailableBalance: jest.fn(() => 10),
        } as unknown as wallet.ShelleyWallet;
        expect(checkWalletBalance(refundsFixture, mockShellyWallet)).rejects.toThrowError('Balance of 10 is not enough to refund 40!');
    });
});