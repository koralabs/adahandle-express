/* eslint-disable @typescript-eslint/ban-ts-comment */
// disabling ban-ts-comment is only acceptable in tests. And it's recommend to use very little when you can.
import * as jwt from "jsonwebtoken";
import * as jwtHelper from "../../helpers/jwt";
import { Request, Response } from 'express';
import { verifyIdTokenHandler } from "./verifyIdToken";
import * as verifyTwitterUser from "../../helpers/firebase";
import { HEADER_ID_TOKEN, HEADER_JWT_ACCESS_TOKEN } from "../../helpers/constants";
import * as StateFixtures from "../../tests/stateFixture";

jest.mock('jsonwebtoken');
jest.mock('../../helpers/jwt');
jest.mock('../../helpers/firebase');

StateFixtures.setupStateFixtures();

describe('VerifyIdToken Tests', () => {
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

    it('should send an successful response', async () => {
        mockRequest = {
            headers: {
                [HEADER_JWT_ACCESS_TOKEN]: 'access-token',
                [HEADER_ID_TOKEN]: 'abc123'
            }
        }

        jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');
        // @ts-ignore
        jest.spyOn(jwt, 'verify').mockResolvedValue('valid');
        jest.spyOn(verifyTwitterUser, 'verifyTwitterUser').mockResolvedValue(12345);

        await verifyIdTokenHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({ "error": false, "message": "Token verification successful", "tokenResult": 12345 });
    });

    it('should fail if token is not valid', async () => {
        mockRequest = {
            headers: {
                [HEADER_JWT_ACCESS_TOKEN]: 'access-token',
                [HEADER_ID_TOKEN]: 'abc123'
            }
        }

        jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');
        // @ts-ignore
        jest.spyOn(jwt, 'verify').mockResolvedValue('valid');
        jest.spyOn(verifyTwitterUser, 'verifyTwitterUser').mockResolvedValue(false);

        await verifyIdTokenHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({ "error": false, "message": "Token verification failed", "tokenResult": false });
    });
});
