/* eslint-disable @typescript-eslint/ban-ts-comment */
// disabling ban-ts-comment is only acceptable in tests. And it's recommend to use very little when you can.
import { Request, Response } from 'express';
import * as jwt from "jsonwebtoken";

import { StateData } from "../../models/firestore/collections/StateData";
import { State } from "../../models/State";
import { mintingQueuePositionHandler } from "./mintingQueuePosition";
import * as jwtHelper from "../../helpers/jwt";
import { HEADER_JWT_ALL_SESSIONS_TOKEN } from '../../helpers/constants';

jest.mock('../../models/firestore/collections/StateData');
jest.mock('../../helpers/jwt');

describe('mintingQueuePositionHandler Tests', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;

    beforeEach(() => {
        jest.resetModules();
        jest.restoreAllMocks();
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

    const stateData: State = new State({
        chainLoad: 0,
        accessQueueSize: 7000,
        mintingQueueSize: 3000,
        updateActiveSessionsLock: false,
        mintPaidSessionsLock: false,
        sendAuthCodesLock: false,
        saveStateLock: false,
        mintConfirmLock: false,
        mintConfirmPaidSessionsLimit: 0,
        usedAddressesLimit: 0,
        accessCodeTimeoutMinutes: 0,
        accessWindowTimeoutMinutes: 0,
        chainLoadThresholdPercent: 0,
        ipfsRateDelay: 0,
        lastMintingTimestamp: 1644872369489, // 10 minutes ago
        lastAccessTimestamp: 0,
    });

    it('should send an 403 with no session token', async () => {
        mockRequest = {
            headers: {
            }
        }

        jest.spyOn(StateData, 'getStateData').mockResolvedValue(stateData);

        await mintingQueuePositionHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
            error: true,
            message: "Must provide a valid session token."
        });
    });

    it('should send an 404 with no userTimestamp', async () => {
        mockRequest = {
            headers: {
                [HEADER_JWT_ALL_SESSIONS_TOKEN]: 'test-session-token'
            }
        }

        jest.spyOn(StateData, 'getStateData').mockResolvedValue(stateData);

        jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');
        // @ts-expect-error
        jest.spyOn(jwt, 'verify').mockResolvedValue({ not: 'real' });

        await mintingQueuePositionHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(403);
        expect(mockResponse.json).toHaveBeenCalledWith({
            error: true,
            message: "Invalid session token."
        });
    });

    it('should send an 200 with no userTimestamp', async () => {
        const sessions = [
            { handle: 'burrito', dateAdded: 1644873560989, },
            { handle: 'taco', dateAdded: 164487349917 },
            { handle: 'enchilada', dateAdded: 1644873435773 },
            { handle: 'salsa', dateAdded: 1644873362049 },
            { handle: 'guacamole', dateAdded: 1644872267349, },
        ]

        mockRequest = {
            headers: {
                [HEADER_JWT_ALL_SESSIONS_TOKEN]: 'test-session-token'
            }
        }

        jest.spyOn(StateData, 'getStateData').mockResolvedValue(stateData);
        jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');
        // @ts-expect-error
        jest.spyOn(jwt, 'verify').mockReturnValue({ sessions });

        await mintingQueuePositionHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
            error: false,
            mintingQueuePosition: 2239,
            minutes: 112
        });
    });
});
