/* eslint-disable @typescript-eslint/ban-ts-comment */
// disabling ban-ts-comment is only acceptable in tests. And it's recommend to use very little when you can.
import { Request, Response } from 'express';
import * as StateFixtures from '../../tests/stateFixture';
import * as jwtHelpers from '../../helpers/jwt';
import { verifyWalletHandler } from './verifyWallet';
import { ActiveSessions } from '../../models/firestore/collections/ActiveSession';

jest.mock('../../models/firestore/collections/ActiveSession');
jest.mock('../../helpers/jwt');
StateFixtures.setupStateFixtures();

describe('VerifyWallet Tests', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;

    beforeEach(() => {
        mockRequest = {};
        mockResponse = {
            // @ts-ignore
            status: jest.fn(() => mockResponse),
            json: jest.fn(),
            cookie: jest.fn()
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should send an 400 response if uid is not provided', async () => {
        mockRequest = {
            headers: {
                burrito: 'burrito'
            }
        };

        await verifyWalletHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
            error: true,
            message: 'Unique identifier required'
        });
    });

    it('should send 200 response', async () => {
        const uid = 'test-uid-abc1234';
        mockRequest = {
            headers: {
                'x-uid': 'test-uid-abc1234'
            }
        };

        jest.spyOn(ActiveSessions, 'getActiveSessionsByEmail').mockResolvedValue([]);
        jest.spyOn(jwtHelpers, 'getKey').mockResolvedValue('test-key');

        await verifyWalletHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
            activeSessions: [],
            data: {
                emailAddress: `noreply+${uid}@adahandle.com`,
                exp: expect.any(Number),
                iat: expect.any(Number),
                isSPO: false
            },
            error: false,
            token: expect.any(String),
            verified: true
        });
    });
});
