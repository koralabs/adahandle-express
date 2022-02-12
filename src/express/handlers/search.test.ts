/* eslint-disable @typescript-eslint/ban-ts-comment */
// disabling ban-ts-comment is only acceptable in tests. And it's recommend to use very little when you can.
import * as jwt from "jsonwebtoken";
import { Request, Response } from 'express';
import { searchHandler } from "./search";
import * as jwtHelper from "../../helpers/jwt";
import { ActiveSessions } from "../../models/firestore/collections/ActiveSession";
import { ReservedHandles } from "../../models/firestore/collections/ReservedHandles";

jest.mock('jsonwebtoken');
jest.mock('../../helpers/jwt');
jest.mock('../../helpers/wallet');
jest.mock('../../models/firestore/collections/ActiveSession');
jest.mock('../../models/firestore/collections/StakePools');
jest.mock('../../models/firestore/collections/ReservedHandles');

describe('Search Tests', () => {
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

  it('should send an 400 response if auth token is not provided', async () => {
    mockRequest = {
      headers: {
        'burrito': 'burrito',
      }
    }

    await searchHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Must provide a valid access and session token." });
  });

  it('should send an 500 response if unable to get key', async () => {
    mockRequest = {
      headers: {
        'x-access-token': 'test-access-token'
      }
    }

    jest.spyOn(jwtHelper, 'getKey').mockResolvedValue(null);

    await searchHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Something went wrong with access secrets." });
  });

  it('should send an 403 response if unable verify jwt accessToken', async () => {
    mockRequest = {
      headers: {
        'x-access-token': 'test-access-token'
      }
    }

    jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');

    // @ts-ignore
    jest.spyOn(jwt, 'verify').mockReturnValueOnce(null);

    await searchHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Provided access token was invalid or expired." });
  });

  it('should send an 403 response if handle is unavailable', async () => {
    mockRequest = {
      headers: {
        'x-access-token': 'test-access-token',
      }
    }

    jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');

    // @ts-ignore
    jest.spyOn(jwt, 'verify').mockReturnValueOnce('valid').mockReturnValueOnce({ handle: 'something.really.bad', emailAddress: 'a@a.com' });
    jest.spyOn(ActiveSessions, 'getActiveSessionsByEmail').mockResolvedValue([]);
    jest.spyOn(ReservedHandles, 'checkAvailability').mockResolvedValue({ available: false, message: 'Handle is not available' });

    await searchHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({
      "error": false, "message": "Success!",
      "response": {
        "available": false,
        "message": "Handle is not available",
      },
    });
  });

  it('should send a successful 200 response', async () => {
    mockRequest = {
      headers: {
        'x-access-token': 'test-access-token',
        'x-handle': 'available.handle'
      }
    }

    jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');

    // @ts-ignore
    jest.spyOn(jwt, 'verify').mockReturnValueOnce('valid').mockReturnValueOnce({ emailAddress: 'a@a.com' });
    jest.spyOn(ActiveSessions, 'getActiveSessionsByEmail').mockResolvedValue([]);
    jest.spyOn(ReservedHandles, 'checkAvailability').mockResolvedValue({ available: true, message: 'Handle is available' });

    await searchHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": false, "message": "Success!", "response": { "available": true, "message": "Handle is available" } });
  });
});
