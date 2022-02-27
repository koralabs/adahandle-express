/* eslint-disable @typescript-eslint/ban-ts-comment */
// disabling ban-ts-comment is only acceptable in tests. And it's recommend to use very little when you can.
import { Request, Response } from 'express';
import * as jwt from "jsonwebtoken";

import { mintingQueuePositionHandler } from "./mintingQueuePosition";
import * as jwtHelper from "../../helpers/jwt";
import { HEADER_JWT_ALL_SESSIONS_TOKEN } from '../../helpers/constants';
import * as StateFixtures from '../../tests/stateFixture'

jest.mock('../../helpers/jwt');
StateFixtures.setupStateFixtures();

describe('mintingQueuePositionHandler Tests', () => {
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

    it('should send an 400 with no session token', async () => {
        mockRequest = {
            headers: {
            }
        }

        await mintingQueuePositionHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
            error: true,
            message: "Must provide a valid session token."
        });
    });

    it('should send an 403 with no sessions', async () => {
        mockRequest = {
            headers: {
                [HEADER_JWT_ALL_SESSIONS_TOKEN]: 'test-session-token'
            }
        }

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

    it('should return zero with no sessions', async () => {
        const sessions = [
            { handle: 'salsa', dateAdded: new Date().setMinutes(new Date().getMinutes() - 20), },
            { handle: 'guacamole', dateAdded: new Date().setMinutes(new Date().getMinutes() - 11), },
        ]

        mockRequest = {
            headers: {
                [HEADER_JWT_ALL_SESSIONS_TOKEN]: 'test-session-token'
            }
        }

        jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');
        // @ts-expect-error
        jest.spyOn(jwt, 'verify').mockReturnValue({ sessions });

        await mintingQueuePositionHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
            error: false,
            mintingQueuePosition: 0,
            minutes: 0
        });
    });

    it('should send an 200 with no userTimestamp', async () => {
        const sessions = [
            { handle: 'burrito', dateAdded: new Date().setMinutes(new Date().getMinutes() - 1), },
            { handle: 'taco', dateAdded: new Date().setMinutes(new Date().getMinutes() - 2), },
            { handle: 'enchilada', dateAdded: new Date().setMinutes(new Date().getMinutes() - 3), },
            { handle: 'salsa', dateAdded: new Date().setMinutes(new Date().getMinutes() - 4), },
            { handle: 'guacamole', dateAdded: new Date().setMinutes(new Date().getMinutes() - 11), },
        ]

        mockRequest = {
            headers: {
                [HEADER_JWT_ALL_SESSIONS_TOKEN]: 'test-session-token'
            }
        }

        jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');
        // @ts-expect-error
        jest.spyOn(jwt, 'verify').mockReturnValue({ sessions });

        await mintingQueuePositionHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
            error: false,
            mintingQueuePosition: expect.any(Number),
            minutes: expect.any(Number)
        });
    });
});
