/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Request, Response } from 'express';
import { stateDataHandler } from './stateData';
import { setupStateFixtures } from '../../tests/stateFixture';

setupStateFixtures();

describe('StateData Tests', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;

    beforeEach(() => {
        mockRequest = {};
        mockResponse = {
            // @ts-ignore
            status: jest.fn(() => mockResponse),
            json: jest.fn()
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should send a successful 200 response', async () => {
        await stateDataHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
            accessCodeTimeoutMinutes: 0,
            accessQueueLimit: 20,
            accessQueueSize: 7000,
            accessWindowTimeoutMinutes: 0,
            adaUsdQuoteHistory: [],
            availableMintingServers: 'testnet01,testnet02',
            chainLoad: 0,
            chainLoadThresholdPercent: 0,
            dynamicPricingEnabled: false,
            error: false,
            fallBackAdaUsd: 1.25,
            handlePriceSettings: undefined,
            handlePrices: {
                basic: 10,
                common: 50,
                rare: 100,
                ultraRare: 500
            },
            ipfsRateDelay: 0,
            lastAccessTimestamp: 0,
            lastMintingTimestamp: expect.any(Number),
            lastQuoteTimestamp: 0,
            message: '',
            minimumWalletAddressAmount: 10000,
            mintConfirmLock: 'UNLOCKED',
            mintConfirmPaidSessionsLimit: 0,
            mintPaidSessionsLock: 'UNLOCKED',
            mintingQueueSize: 3000,
            paidSessionsLimit: 10,
            paymentWindowTimeoutMinutes: 60,
            priceAdaUsdTest: 0,
            priceTestMode: 'OFF',
            refundWalletBalance: 0,
            refundsLock: 'UNLOCKED',
            saveStateLock: 'UNLOCKED',
            sendAuthCodesLock: 'UNLOCKED',
            spoPageEnabled: false,
            totalHandles: undefined,
            updateActiveSessionsLock: 'UNLOCKED',
            usedAddressesLimit: 0,
            walletAddressCollectionName: 'walletAddresses',
            walletConnectorEnabled: false
        });
    });
});
