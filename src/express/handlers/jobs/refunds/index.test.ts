/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Request, Response } from 'express';
import * as cardano from "../../../../helpers/wallet/cardano";
import * as wallet from 'cardano-wallet-js';

import { refundsHandler } from '.';
import { StateData } from '../../../../models/firestore/collections/StateData';
import { UsedAddresses } from '../../../../models/firestore/collections/UsedAddresses';
import { UsedAddress, UsedAddressStatus } from '../../../../models/UsedAddress';
import * as verifyRefund from "./verifyRefund";
import * as checkWalletBalance from "./checkWalletBalance";
import * as processRefunds from "./processRefunds";
import * as constants from "../../../../helpers/constants";
import { Refund } from './processRefunds';
import * as StateFixtures from "../../../../tests/stateFixture";
import { CronState } from '../../../../models/State';

jest.mock('express');
jest.mock('../../../../helpers/wallet/cardano');
jest.mock('../../../../helpers/graphql');
jest.mock('../../../../models/firestore/collections/UsedAddresses');
jest.mock('./verifyRefund');
jest.mock('./checkWalletBalance');
jest.mock('./processRefunds');
StateFixtures.setupStateFixtures();

describe('Refund Cron Tests', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;

    const checkWalletBalanceSpy = jest.spyOn(checkWalletBalance, 'checkWalletBalance');
    const processRefundsSpy = jest.spyOn(processRefunds, 'processRefunds');
    const lockCronSpy = jest.spyOn(StateData, 'checkAndLockCron');
    const unlockCronSpy = jest.spyOn(StateData, 'unlockCron');
    const batchUpdateUsedAddresses = jest.spyOn(UsedAddresses, 'batchUpdateUsedAddresses');

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

    const usedAddressesFixture: UsedAddress[] = [
        new UsedAddress({ id: '0x1' }),
        new UsedAddress({ id: '0x2' }),
        new UsedAddress({ id: '0x3' }),
        new UsedAddress({ id: '0x4' }),
    ]

    const refunds: Refund[] = [{
        paymentAddress: '0x1',
        returnAddress: {
            address: "return_0x1",
            amount: 10,
            index: undefined,
            txHash: undefined,
        }
    }, {
        paymentAddress: '0x2',
        returnAddress: {
            address: "return_0x2",
            amount: 500,
            index: undefined,
            txHash: undefined,
        }
    }]

    describe('updateSessionsHandler tests', () => {
        it('should return 200 if cron is locked', async () => {
            jest.spyOn(UsedAddresses, 'getRefundableAddresses').mockResolvedValue(usedAddressesFixture);
            StateFixtures.state.refundsLock = CronState.LOCKED;
            jest.spyOn(StateData, 'checkAndLockCron').mockResolvedValue(false);
            await refundsHandler(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({ "error": false, "message": "Refunds cron is locked. Try again later." });
        });

        it('should return 200 no refundable sessions are found', async () => {
            jest.spyOn(UsedAddresses, 'getRefundableAddresses').mockResolvedValue([]);
            StateFixtures.state.refundsLock = CronState.UNLOCKED;
            jest.spyOn(StateData, 'checkAndLockCron').mockResolvedValue(true);
            await refundsHandler(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({ "error": false, "message": "No refundable addresses found." });
        });

        it('should return 200 and process refunds', async () => {
            const mockShellyWallet = {
                getTotalBalance: jest.fn(() => 10),
            } as unknown as wallet.ShelleyWallet;

            jest.spyOn(UsedAddresses, 'getRefundableAddresses').mockResolvedValue(usedAddressesFixture);
            jest.spyOn(cardano, 'getMintWalletServer').mockResolvedValue(mockShellyWallet);
            jest.spyOn(constants, 'getMintingWalletId').mockReturnValue('minting_wallet_id');
            jest.spyOn(verifyRefund, 'verifyRefund')
                .mockResolvedValueOnce({ status: UsedAddressStatus.PROCESSED })
                .mockResolvedValueOnce({ status: UsedAddressStatus.PROCESSED })
                .mockResolvedValueOnce({ refund: refunds[0] })
                .mockResolvedValueOnce({ refund: refunds[1] });

            await refundsHandler(mockRequest as Request, mockResponse as Response);

            expect(lockCronSpy).toHaveBeenCalledTimes(1);
            expect(unlockCronSpy).toHaveBeenCalledTimes(1);
            expect(checkWalletBalanceSpy).toHaveBeenCalledTimes(1);
            expect(processRefundsSpy).toHaveBeenCalledTimes(1);
            expect(batchUpdateUsedAddresses).toHaveBeenCalledTimes(1);

            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({ "error": false, "message": "Processed 2 refunds." });
        });
    });
});
