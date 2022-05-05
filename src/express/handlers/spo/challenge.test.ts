/* eslint-disable @typescript-eslint/ban-ts-comment */
// disabling ban-ts-comment is only acceptable in tests. And it's recommend to use very little when you can.
import * as jwt from "jsonwebtoken";
import * as jwtHelper from "../../../helpers/jwt";
import { Request, Response } from 'express';
import { HEADER_JWT_SPO_ACCESS_TOKEN } from "../../../helpers/constants";
import * as StateFixtures from "../../../tests/stateFixture";
import * as runChallengeCommand from "../../../helpers/executeChildProcess";
import { challengeHandler } from './challenge';
import { PoolProofs } from "../../../models/firestore/collections/PoolProofs";
import { StakePools } from "../../../models/firestore/collections/StakePools";
import { ReservedHandles } from "../../../models/firestore/collections/ReservedHandles";
import { StakePool } from "../../../models/StakePool";

jest.mock('jsonwebtoken');
jest.mock('../../../helpers/jwt');
jest.mock('../../../helpers/executeChildProcess');
jest.mock('../../../models/firestore/collections/PoolProofs');
jest.mock('../../../models/firestore/collections/StakePools');
jest.mock('../../../models/firestore/collections/ReservedHandles');

StateFixtures.setupStateFixtures();

describe('Challenge Tests', () => {
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

    it('should send an successful challenge response', async () => {
        mockRequest = {
            headers: {
                [HEADER_JWT_SPO_ACCESS_TOKEN]: 'access-token',
            },
            body: { bech32PoolId: 'pool1abc123', cborHexEncodedVRFKey: 'abc123', hexEncodedVKeyHash: 'abc123' }
        }

        jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');
        // @ts-ignore
        jest.spyOn(jwt, 'verify').mockReturnValue('valid');

        jest.spyOn(StakePools, 'getStakePoolsByPoolId').mockResolvedValue(new StakePool('abc123', 'HANDLE', 'stake123'));
        jest.spyOn(ReservedHandles, 'checkAvailability').mockResolvedValue({ available: true });

        jest.spyOn(runChallengeCommand, 'runChallengeCommand').mockResolvedValue({ nonce: 'abc123', status: 'ok', domain: 'adahandle.com' });
        jest.spyOn(PoolProofs, 'addPoolProof')

        await challengeHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({ challengeResult: { domain: "adahandle.com", nonce: "abc123", status: "ok" }, handle: 'handle', error: false, message: "Challenge successful" });
    });

    it('should fail if invalid access key', async () => {
        mockRequest = {
            headers: {
                [HEADER_JWT_SPO_ACCESS_TOKEN]: 'invalid-token',
            }
        }

        jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');
        // @ts-ignore
        jest.spyOn(jwt, 'verify').mockReturnValue(false);

        await challengeHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(403);
        expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Provided access token was invalid or expired." });
    });

    it('should fail with missing body', async () => {
        mockRequest = {
            headers: {
                [HEADER_JWT_SPO_ACCESS_TOKEN]: 'invalid-token',
            },
            body: {}
        }

        jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');
        // @ts-ignore
        jest.spyOn(jwt, 'verify').mockReturnValue('valid');

        await challengeHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Missing required parameters." });
    });

    it('should fail with invalid pool id', async () => {
        mockRequest = {
            headers: {
                [HEADER_JWT_SPO_ACCESS_TOKEN]: 'access-token',
            },
            body: { bech32PoolId: 'not valid', cborHexEncodedVRFKey: 'abc123', hexEncodedVKeyHash: 'abc123' }
        }

        jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');
        // @ts-ignore
        jest.spyOn(jwt, 'verify').mockReturnValue('valid');
        jest.spyOn(runChallengeCommand, 'runChallengeCommand').mockResolvedValue({ nonce: 'abc123', status: 'ok', domain: 'adahandle.com' });
        jest.spyOn(PoolProofs, 'addPoolProof')

        await challengeHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Invalid parameters." });
    });

    it('should fail with invalid vrf key', async () => {
        mockRequest = {
            headers: {
                [HEADER_JWT_SPO_ACCESS_TOKEN]: 'access-token',
            },
            body: { bech32PoolId: 'poolvalid', cborHexEncodedVRFKey: 'exec 123;', hexEncodedVKeyHash: 'abc123' }
        }

        jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');
        // @ts-ignore
        jest.spyOn(jwt, 'verify').mockReturnValue('valid');
        jest.spyOn(runChallengeCommand, 'runChallengeCommand').mockResolvedValue({ nonce: 'abc123', status: 'ok', domain: 'adahandle.com' });
        jest.spyOn(PoolProofs, 'addPoolProof')

        await challengeHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Invalid parameters." });
    });

    it('should fail with invalid vkey hash', async () => {
        mockRequest = {
            headers: {
                [HEADER_JWT_SPO_ACCESS_TOKEN]: 'access-token',
            },
            body: { bech32PoolId: 'poolvalid', cborHexEncodedVRFKey: 'abc123', hexEncodedVKeyHash: ';' }
        }

        jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');
        // @ts-ignore
        jest.spyOn(jwt, 'verify').mockReturnValue('valid');
        jest.spyOn(runChallengeCommand, 'runChallengeCommand').mockResolvedValue({ nonce: 'abc123', status: 'ok', domain: 'adahandle.com' });
        jest.spyOn(PoolProofs, 'addPoolProof')

        await challengeHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Invalid parameters." });
    });
});
