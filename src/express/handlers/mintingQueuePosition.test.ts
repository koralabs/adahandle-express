/* eslint-disable @typescript-eslint/ban-ts-comment */
// disabling ban-ts-comment is only acceptable in tests. And it's recommend to use very little when you can.
import { Request, Response } from 'express';
import * as jwt from "jsonwebtoken";

import { mintingQueuePositionHandler } from "./mintingQueuePosition";
import * as jwtHelper from "../../helpers/jwt";
import { CreatedBySystem, HEADER_JWT_ALL_SESSIONS_TOKEN } from '../../helpers/constants';
import * as StateFixtures from '../../tests/stateFixture'
import { ActiveSessions } from '../../models/firestore/collections/ActiveSession';
import { ActiveSession, Status, WorkflowStatus } from '../../models/ActiveSession';

jest.mock('../../helpers/jwt');
jest.mock('../../models/firestore/collections/ActiveSession');
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

        jest.spyOn(ActiveSessions, 'getByHandle').mockResolvedValue([]);
        jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');
        // @ts-expect-error
        jest.spyOn(jwt, 'verify').mockReturnValue({ sessions });

        await mintingQueuePositionHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({ "error": false, "sessions": [] });
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

        jest.spyOn(ActiveSessions, 'getByHandle')
            .mockResolvedValueOnce([
                new ActiveSession({ handle: 'burrito', emailAddress: '', cost: 100, paymentAddress: '1', createdBySystem: CreatedBySystem.UI, start: Date.now(), status: Status.PENDING }),
            ]).mockResolvedValueOnce([
                new ActiveSession({ handle: 'taco', emailAddress: '', cost: 100, paymentAddress: '1', createdBySystem: CreatedBySystem.UI, start: Date.now(), status: Status.PAID, workflowStatus: WorkflowStatus.PENDING }),
            ]).mockResolvedValueOnce([
                new ActiveSession({ handle: 'enchilada', emailAddress: '', cost: 100, paymentAddress: '1', createdBySystem: CreatedBySystem.UI, start: Date.now(), status: Status.PAID, workflowStatus: WorkflowStatus.SUBMITTED, txId: 'txId1' }),
            ]).mockResolvedValueOnce([
                new ActiveSession({ handle: 'salsa', emailAddress: '', cost: 100, paymentAddress: '1', createdBySystem: CreatedBySystem.UI, start: Date.now(), status: Status.PAID, workflowStatus: WorkflowStatus.CONFIRMED, txId: 'txId2' }),
            ]).mockResolvedValueOnce([
                new ActiveSession({ handle: 'guacamole', emailAddress: '', cost: 100, paymentAddress: '1', createdBySystem: CreatedBySystem.UI, start: Date.now(), status: Status.REFUNDABLE }),
            ]);
        jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');
        // @ts-expect-error
        jest.spyOn(jwt, 'verify').mockReturnValue({ sessions });

        await mintingQueuePositionHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
            "error": false, "sessions": [
                { "handle": "burrito", "type": "WAITING_FOR_PAYMENT" },
                { "handle": "taco", "mintingPosition": { "minutes": 150, "position": 3000 }, "type": "WAITING_FOR_MINING" },
                { "handle": "enchilada", "txId": "txId1", "type": "WAITING_FOR_CONFIRMATION" },
                { "handle": "salsa", "txId": "txId2", "type": "CONFIRMED" },
                { "handle": "guacamole", "type": "REFUNDED" }
            ]
        });
    });
});
