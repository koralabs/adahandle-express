/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Request, Response } from 'express';
import { refundsHandler } from '.';
import { StateData } from '../../../../models/firestore/collections/StateData';
import { State } from '../../../../models/State';
import { UsedAddresses } from '../../../../models/firestore/collections/UsedAddresses';
import { UsedAddress } from '../../../../models/UsedAddress';
import * as verifyRefund from "./verifyRefund";
import * as getRefundWallet from "./getRefundWallet";
import * as processRefund from "./processRefund";
import { Refund } from './processRefund';

jest.mock('express');
jest.mock('../../../../helpers/graphql');
jest.mock('../../../../models/firestore/collections/UsedAddresses');
jest.mock('../../../../models/firestore/collections/PaidSessions');
jest.mock('../../../../models/firestore/collections/StateData');
jest.mock('./verifyRefund');
jest.mock('./getRefundWallet');
jest.mock('./processRefund');

describe('Refund Cron Tests', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;

    const getRefundWalletSpy = jest.spyOn(getRefundWallet, 'getRefundWallet');
    const processRefundSpy = jest.spyOn(processRefund, 'processRefund');
    const lockCronSpy = jest.spyOn(StateData, 'lockCron');
    const unlockCronSpy = jest.spyOn(StateData, 'unlockCron');

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
        new UsedAddress('0x1'),
        new UsedAddress('0x2'),
        new UsedAddress('0x3'),
        new UsedAddress('0x4'),
    ]

    const refunds: Refund[] = [{
        paymentAddress: '0x1',
        returnAddress: 'return_0x1',
        amount: 10
    }, {
        paymentAddress: '0x2',
        returnAddress: 'return_0x2',
        amount: 500
    }]

    describe('updateSessionsHandler tests', () => {
        it('should return 200 if cron is locked', async () => {
            jest.spyOn(UsedAddresses, 'getRefundableAddresses').mockResolvedValue(usedAddressesFixture);
            jest.spyOn(StateData, 'getStateData').mockResolvedValue(new State({ chainLoad: .77, position: 10, refunds_lock: true, totalHandles: 171 }));
            await refundsHandler(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({ "error": false, "message": "Refunds cron is locked. Try again later." });
        });

        it('should return 200 no refundable sessions are found', async () => {
            jest.spyOn(UsedAddresses, 'getRefundableAddresses').mockResolvedValue([]);
            jest.spyOn(StateData, 'getStateData').mockResolvedValue(new State({ chainLoad: .77, position: 10, refunds_lock: false, totalHandles: 171 }));
            await refundsHandler(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({ "error": false, "message": "No refundable addresses found." });
        });

        it('should return 200 and process refunds', async () => {
            jest.spyOn(UsedAddresses, 'getRefundableAddresses').mockResolvedValue(usedAddressesFixture);
            jest.spyOn(StateData, 'getStateData').mockResolvedValue(new State({ chainLoad: .77, position: 10, refunds_lock: false, totalHandles: 171 }));
            jest.spyOn(verifyRefund, 'verifyRefund')
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(refunds[0])
                .mockResolvedValueOnce(refunds[1]);

            await refundsHandler(mockRequest as Request, mockResponse as Response);

            expect(lockCronSpy).toHaveBeenCalledTimes(1);
            expect(unlockCronSpy).toHaveBeenCalledTimes(1);
            expect(getRefundWalletSpy).toHaveBeenCalledTimes(1);
            expect(processRefundSpy).toHaveBeenCalledTimes(2);

            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({ "error": false, "message": "Processed 2 refunds." });
        });
    });
});
