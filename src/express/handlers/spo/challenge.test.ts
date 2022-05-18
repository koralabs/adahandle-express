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

        jest.spyOn(StakePools, 'getStakePoolsByPoolId').mockResolvedValue(new StakePool('abc123', 'HANDLE', 'stake123', [], false, 'abc123'));
        jest.spyOn(ReservedHandles, 'checkAvailability').mockResolvedValue({ available: true });
        jest.spyOn(StakePools, 'getStakePoolsByTicker').mockResolvedValue([new StakePool('abc123', 'HANDLE', 'stake123', [], false, 'abc123')]);


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

    it('should fail if pool cannot be found in the database', async () => {
        mockRequest = {
            headers: {
                [HEADER_JWT_SPO_ACCESS_TOKEN]: 'access-token',
            },
            body: { bech32PoolId: 'pool1abc123', cborHexEncodedVRFKey: 'abc123', hexEncodedVKeyHash: 'abc123' }
        }

        jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');
        // @ts-ignore
        jest.spyOn(jwt, 'verify').mockReturnValue('valid');

        jest.spyOn(StakePools, 'getStakePoolsByPoolId').mockResolvedValue(null);

        await challengeHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "No ticker found for Pool ID." });
    });

    it('should fail if vrfkeyHash does not match', async () => {
        mockRequest = {
            headers: {
                [HEADER_JWT_SPO_ACCESS_TOKEN]: 'access-token',
            },
            body: { bech32PoolId: 'pool1abc123', cborHexEncodedVRFKey: 'abc123', hexEncodedVKeyHash: 'abc123' }
        }

        jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');
        // @ts-ignore
        jest.spyOn(jwt, 'verify').mockReturnValue('valid');

        jest.spyOn(StakePools, 'getStakePoolsByPoolId').mockResolvedValue(new StakePool('abc123', 'HANDLE', 'stake123', [], false, 'not-abc123'));
        jest.spyOn(ReservedHandles, 'checkAvailability').mockResolvedValue({ available: true });

        await challengeHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Pool details do not match." });
    });

    it('should fail handle is unavailable', async () => {
        mockRequest = {
            headers: {
                [HEADER_JWT_SPO_ACCESS_TOKEN]: 'access-token',
            },
            body: { bech32PoolId: 'pool1abc123', cborHexEncodedVRFKey: 'abc123', hexEncodedVKeyHash: 'abc123' }
        }

        jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');
        // @ts-ignore
        jest.spyOn(jwt, 'verify').mockReturnValue('valid');

        jest.spyOn(StakePools, 'getStakePoolsByPoolId').mockResolvedValue(new StakePool('abc123', 'HANDLE', 'stake123', [], false, 'abc123'));
        jest.spyOn(ReservedHandles, 'checkAvailability').mockResolvedValue({ available: false, type: 'private' });

        await challengeHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Handle is unavailable." });
    });

    it('should fail if ticker has duplicates and requesting pool is not the oldest record', async () => {
        mockRequest = {
            headers: {
                [HEADER_JWT_SPO_ACCESS_TOKEN]: 'access-token',
            },
            body: { bech32PoolId: 'pool1abc123', cborHexEncodedVRFKey: 'abc123', hexEncodedVKeyHash: 'abc123' }
        }

        jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');
        // @ts-ignore
        jest.spyOn(jwt, 'verify').mockReturnValue('valid');

        jest.spyOn(StakePools, 'getStakePoolsByPoolId').mockResolvedValue(new StakePool('abc123', 'HANDLE', 'stake123', [], false, 'abc123'));
        jest.spyOn(ReservedHandles, 'checkAvailability').mockResolvedValue({ available: true });
        jest.spyOn(StakePools, 'getStakePoolsByTicker').mockResolvedValue([new StakePool('pool456', 'HANDLE', 'stake123', [], false, 'abc123', new Date(Date.now() - 600000).getTime()), new StakePool('pool1abc123', 'HANDLE', 'stake123', [], false, 'abc123', new Date(Date.now() - 300000).getTime())]);

        await challengeHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Pool has duplicates. Please use the oldest VRF/Pool id record to mint Handle." });
    });

    it('should pass if ticker has duplicates and requesting pool is the oldest record', async () => {
        mockRequest = {
            headers: {
                [HEADER_JWT_SPO_ACCESS_TOKEN]: 'access-token',
            },
            body: { bech32PoolId: 'pool456', cborHexEncodedVRFKey: 'abc123', hexEncodedVKeyHash: 'abc123' }
        }

        jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');
        // @ts-ignore
        jest.spyOn(jwt, 'verify').mockReturnValue('valid');

        jest.spyOn(StakePools, 'getStakePoolsByPoolId').mockResolvedValue(new StakePool('abc123', 'HANDLE', 'stake123', [], false, 'abc123'));
        jest.spyOn(ReservedHandles, 'checkAvailability').mockResolvedValue({ available: true });
        jest.spyOn(StakePools, 'getStakePoolsByTicker').mockResolvedValue([new StakePool('pool456', 'HANDLE', 'stake123', [], false, 'abc123', new Date(Date.now() - 600000).getTime()), new StakePool('pool1abc123', 'HANDLE', 'stake123', [], false, 'abc123', new Date(Date.now() - 300000).getTime())]);

        jest.spyOn(runChallengeCommand, 'runChallengeCommand').mockResolvedValue({ nonce: 'abc123', status: 'ok', domain: 'adahandle.com' });
        jest.spyOn(PoolProofs, 'addPoolProof')

        await challengeHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({ "challengeResult": { "domain": "adahandle.com", "nonce": "abc123", "status": "ok" }, "error": false, "handle": "handle", "message": "Challenge successful" });
    });
});
