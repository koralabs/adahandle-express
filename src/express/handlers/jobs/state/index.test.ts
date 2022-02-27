import { Request, Response } from 'express';
import * as caradnoHelper from "../../../../helpers/cardano";
import { CreatedBySystem } from '../../../../helpers/constants';
import { ActiveSession } from '../../../../models/ActiveSession';
import { AccessQueues } from '../../../../models/firestore/collections/AccessQueues';
import { ActiveSessions } from '../../../../models/firestore/collections/ActiveSession';
import { StateData } from '../../../../models/firestore/collections/StateData';
import * as updateMintingWalletBalances from "./updateMintingWalletBalances";
import { stateHandler } from './';
import * as StateFixtures from "../../../../tests/stateFixture";

jest.mock('express');
jest.mock('../../../../helpers/cardano');
jest.mock('../../../../models/ActiveSession');
jest.mock('../../../../models/firestore/collections/AccessQueues');
jest.mock('../../../../models/firestore/collections/ActiveSession');
jest.mock('./updateMintingWalletBalances');
StateFixtures.setupStateFixtures();

describe('State Cron Tests', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;

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

    it('should return 200', async () => {
        const getAccessQueueCountSpy = jest.spyOn(AccessQueues, 'getAccessQueueCount').mockResolvedValue(1);
        const getPaidPendingSessionsSpy = jest.spyOn(ActiveSessions, 'getPaidPendingSessions').mockResolvedValue(mockedActiveSessions);
        const getChainLoadSpy = jest.spyOn(caradnoHelper, 'getChainLoad').mockResolvedValue(1);
        const getTotalHandlesSpy = jest.spyOn(caradnoHelper, 'getTotalHandles').mockResolvedValue(1);
        const upsertStateDataSpy = jest.spyOn(StateData, 'upsertStateData');
        const updateMintingWalletBalancesSpy = jest.spyOn(updateMintingWalletBalances, 'updateMintingWalletBalances');

        await stateHandler(mockRequest as Request, mockResponse as Response);

        expect(getAccessQueueCountSpy).toHaveBeenCalledTimes(1);
        expect(getPaidPendingSessionsSpy).toHaveBeenCalledTimes(1);
        expect(getChainLoadSpy).toHaveBeenCalledTimes(1);
        expect(getTotalHandlesSpy).toHaveBeenCalledTimes(1);
        expect(upsertStateDataSpy).toHaveBeenCalledTimes(1);
        expect(updateMintingWalletBalancesSpy).toHaveBeenCalledTimes(1);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({ "accessQueueSize": 1, "chainLoad": 1, "error": false, "mintingQueueSize": 2, "totalHandles": 1 });
    });
});
