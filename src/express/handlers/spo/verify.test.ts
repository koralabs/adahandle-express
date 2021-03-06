import * as jwt from 'jsonwebtoken';
import * as jwtHelper from '../../../helpers/jwt';
import * as fs from 'fs';
import { Request, Response } from 'express';
import { HEADER_JWT_SPO_ACCESS_TOKEN } from '../../../helpers/constants';
import * as StateFixtures from '../../../tests/stateFixture';
import * as runChallengeCommand from '../../../helpers/executeChildProcess';
import { verifyHandler } from './verify';
import { PoolProofs } from '../../../models/firestore/collections/PoolProofs';
import { PoolProof } from '../../../models/PoolProof';
import { StakePools } from '../../../models/firestore/collections/StakePools';
import { StakePool } from '../../../models/StakePool';
import { ReservedHandles } from '../../../models/firestore/collections/ReservedHandles';
import * as createSpoSession from './createSpoSession';

jest.mock('jsonwebtoken');
jest.mock('fs');
jest.mock('../../../helpers/jwt');
jest.mock('../../../helpers/executeChildProcess');
jest.mock('../../../models/firestore/collections/PoolProofs');
jest.mock('../../../models/firestore/collections/StakePools');
jest.mock('../../../models/firestore/collections/ReservedHandles');
jest.mock('./createSpoSession');

StateFixtures.setupStateFixtures();

describe('Verify Tests', () => {
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

    it('should send an successful verify response', async () => {
        mockRequest = {
            headers: {
                [HEADER_JWT_SPO_ACCESS_TOKEN]: 'access-token'
            },
            body: { poolId: 'pool1abc123', signature: 'abc123' }
        };

        jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        jest.spyOn(jwt, 'verify').mockReturnValue('valid');
        jest.spyOn(PoolProofs, 'getPoolProofById').mockResolvedValue(
            new PoolProof({
                poolId: 'pool1abc123',
                vrfKey: 'abc123',
                vKeyHash: 'abc123',
                start: Date.now(),
                nonce: 'abc123'
            })
        );

        jest.spyOn(StakePools, 'getStakePoolByPoolId').mockResolvedValue(
            new StakePool({ id: 'abc123', ticker: 'HANDLE', stakeKey: 'stake123', isOG: false })
        );
        jest.spyOn(ReservedHandles, 'checkAvailability').mockResolvedValue({ available: true });

        jest.spyOn(createSpoSession, 'createSpoSession').mockResolvedValue('addr1testing');

        jest.spyOn(runChallengeCommand, 'runVerifyCommand').mockResolvedValue({ status: 'ok' });
        jest.spyOn(fs, 'writeFileSync');
        jest.spyOn(PoolProofs, 'updatePoolProof');

        await verifyHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
            address: 'addr1testing',
            cost: 250,
            error: false,
            handle: 'handle',
            message: 'Verified'
        });
    });

    it('should fail if invalid access key', async () => {
        mockRequest = {
            headers: {
                [HEADER_JWT_SPO_ACCESS_TOKEN]: 'invalid-token'
            },
            body: {}
        };

        jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        jest.spyOn(jwt, 'verify').mockReturnValue(false);

        await verifyHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(403);
        expect(mockResponse.json).toHaveBeenCalledWith({
            error: true,
            message: 'Provided access token was invalid or expired.'
        });
    });

    it('should fail if pool cannot be found', async () => {
        mockRequest = {
            headers: {
                [HEADER_JWT_SPO_ACCESS_TOKEN]: 'invalid-token'
            },
            body: {}
        };

        jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        jest.spyOn(jwt, 'verify').mockReturnValue('valid');

        jest.spyOn(PoolProofs, 'getPoolProofById').mockResolvedValue(null);

        await verifyHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({ error: true, message: 'Proof not found.' });
    });

    it('should fail with missing signature', async () => {
        mockRequest = {
            headers: {
                [HEADER_JWT_SPO_ACCESS_TOKEN]: 'invalid-token'
            },
            body: {
                poolId: 'pool1abc123'
            }
        };

        jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        jest.spyOn(jwt, 'verify').mockReturnValue('valid');

        jest.spyOn(PoolProofs, 'getPoolProofById').mockResolvedValue(
            new PoolProof({
                poolId: 'pool1abc123',
                vrfKey: 'abc123',
                vKeyHash: 'abc123',
                start: Date.now(),
                nonce: 'abc123'
            })
        );

        await verifyHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({ error: true, message: 'Signature required.' });
    });

    it('should fail with invalid signature', async () => {
        mockRequest = {
            headers: {
                [HEADER_JWT_SPO_ACCESS_TOKEN]: 'access-token'
            },
            body: { signature: `abc123;` }
        };

        jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        jest.spyOn(jwt, 'verify').mockReturnValue('valid');

        jest.spyOn(PoolProofs, 'getPoolProofById').mockResolvedValue(
            new PoolProof({
                poolId: 'pool1abc123',
                vrfKey: 'abc123',
                vKeyHash: 'abc123',
                start: Date.now(),
                nonce: 'abc123'
            })
        );

        await verifyHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({ error: true, message: 'Invalid signature.' });
    });

    it('should fail if nonce is older than 5 minutes', async () => {
        mockRequest = {
            headers: {
                [HEADER_JWT_SPO_ACCESS_TOKEN]: 'access-token'
            },
            body: { signature: `abc123` }
        };

        jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        jest.spyOn(jwt, 'verify').mockReturnValue('valid');

        jest.spyOn(PoolProofs, 'getPoolProofById').mockResolvedValue(
            new PoolProof({
                poolId: 'pool1abc123',
                vrfKey: 'abc123',
                vKeyHash: 'abc123',
                start: Date.now() - 5 * 60 * 1001,
                nonce: 'abc123'
            })
        );

        await verifyHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({ error: true, message: 'Verification timeout.' });
    });

    it('should fail if pool cannot be found in the database', async () => {
        mockRequest = {
            headers: {
                [HEADER_JWT_SPO_ACCESS_TOKEN]: 'access-token'
            },
            body: { poolId: 'pool1abc123', signature: 'abc123' }
        };

        jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        jest.spyOn(jwt, 'verify').mockReturnValue('valid');
        jest.spyOn(PoolProofs, 'getPoolProofById').mockResolvedValue(
            new PoolProof({
                poolId: 'pool1abc123',
                vrfKey: 'abc123',
                vKeyHash: 'abc123',
                start: Date.now(),
                nonce: 'abc123'
            })
        );

        jest.spyOn(StakePools, 'getStakePoolByPoolId').mockResolvedValue(null);

        await verifyHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({ error: true, message: 'No ticker found for Pool ID.' });
    });

    it('should fail if pool is retired', async () => {
        mockRequest = {
            headers: {
                [HEADER_JWT_SPO_ACCESS_TOKEN]: 'access-token'
            },
            body: { poolId: 'pool1abc123', signature: 'abc123' }
        };

        jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        jest.spyOn(jwt, 'verify').mockReturnValue('valid');
        jest.spyOn(PoolProofs, 'getPoolProofById').mockResolvedValue(
            new PoolProof({
                poolId: 'pool1abc123',
                vrfKey: 'abc123',
                vKeyHash: 'abc123',
                start: Date.now(),
                nonce: 'abc123'
            })
        );

        jest.spyOn(StakePools, 'getStakePoolByPoolId').mockResolvedValue(
            new StakePool({ id: 'abc123', ticker: 'HANDLE', stakeKey: 'stake123', isOG: false, isRetired: true })
        );

        await verifyHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({ error: true, message: 'No ticker found for Pool ID.' });
    });

    it('should fail if pool is unavailable and not an SPO reserved handle', async () => {
        mockRequest = {
            headers: {
                [HEADER_JWT_SPO_ACCESS_TOKEN]: 'access-token'
            },
            body: { poolId: 'pool1abc123', signature: 'abc123' }
        };

        jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        jest.spyOn(jwt, 'verify').mockReturnValue('valid');
        jest.spyOn(PoolProofs, 'getPoolProofById').mockResolvedValue(
            new PoolProof({
                poolId: 'pool1abc123',
                vrfKey: 'abc123',
                vKeyHash: 'abc123',
                start: Date.now(),
                nonce: 'abc123'
            })
        );

        jest.spyOn(StakePools, 'getStakePoolByPoolId').mockResolvedValue(
            new StakePool({ id: 'abc123', ticker: 'HANDLE', stakeKey: 'stake123', isOG: false })
        );
        jest.spyOn(ReservedHandles, 'checkAvailability').mockResolvedValue({ available: false, type: 'private' });

        await verifyHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({ error: true, message: 'Handle is unavailable.' });
    });

    it('should fail if unable to create SPO active session', async () => {
        mockRequest = {
            headers: {
                [HEADER_JWT_SPO_ACCESS_TOKEN]: 'access-token'
            },
            body: { poolId: 'pool1abc123', signature: 'abc123' }
        };

        jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        jest.spyOn(jwt, 'verify').mockReturnValue('valid');
        jest.spyOn(PoolProofs, 'getPoolProofById').mockResolvedValue(
            new PoolProof({
                poolId: 'pool1abc123',
                vrfKey: 'abc123',
                vKeyHash: 'abc123',
                start: Date.now(),
                nonce: 'abc123'
            })
        );

        jest.spyOn(StakePools, 'getStakePoolByPoolId').mockResolvedValue(
            new StakePool({ id: 'abc123', ticker: 'HANDLE', stakeKey: 'stake123', isOG: false })
        );
        jest.spyOn(ReservedHandles, 'checkAvailability').mockResolvedValue({ available: true });

        jest.spyOn(createSpoSession, 'createSpoSession').mockResolvedValue(null);

        await verifyHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({ error: true, message: 'Cannot register handle.' });
    });
});
