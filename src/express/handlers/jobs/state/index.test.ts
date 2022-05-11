import { Request, Response } from 'express';
import * as caradnoHelper from "../../../../helpers/cardano";
import { CreatedBySystem } from '../../../../helpers/constants';
import { ActiveSession } from '../../../../models/ActiveSession';
import { AccessQueues } from '../../../../models/firestore/collections/AccessQueues';
import { ActiveSessions } from '../../../../models/firestore/collections/ActiveSession';
import { StateData } from '../../../../models/firestore/collections/StateData';
import * as updateMintingWalletBalances from "./updateMintingWalletBalances";
import * as checkForDoubleMint from "./checkForDoubleMint";
import * as getRefundWalletBalance from "./getRefundWalletBalance";
import { stateHandler } from './';
import * as StateFixtures from "../../../../tests/stateFixture";
import { WalletAddresses } from '../../../../models/firestore/collections/WalletAddresses';
import { Logger } from '../../../../helpers/Logger';

jest.mock('express');
jest.mock('../../../../helpers/cardano');
jest.mock('../../../../models/ActiveSession');
jest.mock('../../../../models/firestore/collections/AccessQueues');
jest.mock('../../../../models/firestore/collections/ActiveSession');
jest.mock('./updateMintingWalletBalances');
jest.mock('./checkForDoubleMint');
jest.mock('./getRefundWalletBalance');
jest.mock('../../../../models/firestore/collections/WalletAddresses');

StateFixtures.setupStateFixtures();

describe('State Cron Tests', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;

    const mockedActiveSessions = [
        new ActiveSession({
            emailAddress: '',
            cost: 0,
            handle: '',
            paymentAddress: '',
            start: 0,
            createdBySystem: CreatedBySystem.UI,
        }),
        new ActiveSession({
            emailAddress: '',
            cost: 0,
            handle: '',
            paymentAddress: '',
            start: 0,
            createdBySystem: CreatedBySystem.UI,
        })
    ];

    const getAccessQueueCountSpy = jest.spyOn(AccessQueues, 'getAccessQueueCount').mockResolvedValue(1);
    const getPaidPendingSessionsSpy = jest.spyOn(ActiveSessions, 'getPaidPendingSessions').mockResolvedValue(mockedActiveSessions);
    const getChainLoadSpy = jest.spyOn(caradnoHelper, 'getChainLoad').mockResolvedValue(1);
    const getTotalHandlesSpy = jest.spyOn(caradnoHelper, 'getTotalHandles').mockResolvedValue(1);
    const upsertStateDataSpy = jest.spyOn(StateData, 'upsertStateData');
    const updateMintingWalletBalancesSpy = jest.spyOn(updateMintingWalletBalances, 'updateMintingWalletBalances');
    const checkForDoubleMintSpy = jest.spyOn(checkForDoubleMint, 'checkForDoubleMint');
    const getRefundWalletBalanceSpy = jest.spyOn(getRefundWalletBalance, 'getRefundWalletBalance');

    beforeEach(() => {
        mockRequest = {};
        mockResponse = {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            status: jest.fn(() => mockResponse),
            json: jest.fn()
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should return 200', async () => {
        jest.spyOn(WalletAddresses, 'getLatestWalletAddressIndex').mockResolvedValue(10001);

        await stateHandler(mockRequest as Request, mockResponse as Response);

        expect(getAccessQueueCountSpy).toHaveBeenCalledTimes(1);
        expect(getPaidPendingSessionsSpy).toHaveBeenCalledTimes(1);
        expect(getChainLoadSpy).toHaveBeenCalledTimes(1);
        expect(getTotalHandlesSpy).toHaveBeenCalledTimes(1);
        expect(upsertStateDataSpy).toHaveBeenCalledTimes(1);
        expect(updateMintingWalletBalancesSpy).toHaveBeenCalledTimes(1);
        expect(checkForDoubleMintSpy).toHaveBeenCalledTimes(1);
        expect(getRefundWalletBalanceSpy).toHaveBeenCalledTimes(1);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({ "accessQueueSize": 1, "chainLoad": 1, "error": false, "mintingQueueSize": 2, "totalHandles": 1 });
    });

    it('should notify if wallet addresses is less than minimum amount', async () => {
        jest.spyOn(WalletAddresses, 'getLatestWalletAddressIndex').mockResolvedValue(1);
        const loggerSpy = jest.spyOn(Logger, 'log');

        await stateHandler(mockRequest as Request, mockResponse as Response);

        expect(loggerSpy).toHaveBeenCalledWith({ "category": "NOTIFY", "event": "stateHandler.minWalletAddressAmount", "message": "Wallet address amount is lower than minimum amount" });
    });
});
