/* eslint-disable @typescript-eslint/ban-ts-comment */
// disabling ban-ts-comment is only acceptable in tests. And it's recommend to use very little when you can.
import * as jwt from "jsonwebtoken";
import { Request, Response } from 'express';
import { sessionHandler } from "./session";
import { getKey } from "../../helpers/jwt";
import { mocked } from 'ts-jest/utils';
import { getNewAddress } from "../../helpers/wallet";
import { ActiveSessions } from "../../models/firestore/collections/ActiveSession";

jest.mock('jsonwebtoken');
jest.mock('../../helpers/jwt');
jest.mock('../../helpers/wallet');
jest.mock('../../models/firestore/collections/ActiveSession');

describe('Session Tests', () => {
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
        'x-session-token': 'test-session-token'
      }
    }

    await sessionHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Must provide a valid access and session token." });
  });

  it('should send an 400 response if session token is not provided', async () => {
    mockRequest = {
      headers: {
        'x-access-token': 'test-access-token',
        'burrito': 'burrito',
      }
    }

    await sessionHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Must provide a valid access and session token." });
  });

  it('should send an 500 response if unable to get key', async () => {
    mockRequest = {
      headers: {
        'x-access-token': 'test-access-token',
        'x-session-token': 'test-session-token'
      }
    }

    mocked(getKey).mockResolvedValue(null);

    await sessionHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Something went wrong with access secrets." });
  });

  it('should send an 403 response if unable verify jwt accessToken', async () => {
    mockRequest = {
      headers: {
        'x-access-token': 'test-access-token',
        'x-session-token': 'test-session-token'
      }
    }

    mocked(getKey).mockResolvedValue('valid');

    // @ts-ignore
    mocked(jwt.verify).mockReturnValueOnce(null);

    await sessionHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Provided access token was invalid or expired." });
  });

  it('should send an 403 response if unable verify jwt sessionToken', async () => {
    mockRequest = {
      headers: {
        'x-access-token': 'test-access-token',
        'x-session-token': 'test-session-token'
      }
    }

    mocked(getKey).mockResolvedValue('valid');

    // @ts-ignore
    mocked(jwt.verify).mockReturnValueOnce('valid');

    await sessionHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Invalid session token." });
  });

  it('should send an 403 response if handle is invalid', async () => {
    mockRequest = {
      headers: {
        'x-access-token': 'test-access-token',
        'x-session-token': 'test-session-token'
      }
    }

    mocked(getKey).mockResolvedValue('valid');

    // @ts-ignore
    mocked(jwt.verify).mockReturnValueOnce('valid').mockReturnValueOnce({ handle: '!!NotValid!!' });

    await sessionHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Invalid handle format." });
  });

  it('should send an 500 response if address cannot be found', async () => {
    mockRequest = {
      headers: {
        'x-access-token': 'test-access-token',
        'x-session-token': 'test-session-token'
      }
    }

    mocked(getKey).mockResolvedValue('valid');

    // @ts-ignore
    mocked(jwt.verify).mockReturnValueOnce('valid').mockReturnValueOnce({ handle: 'validHandle' });
    mocked(getNewAddress).mockResolvedValue(false);

    await sessionHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Failed to retrieve payment address data." });
  });

  it('should send an 400 response if handle already exists in an active session', async () => {
    mockRequest = {
      headers: {
        'x-access-token': 'test-access-token',
        'x-session-token': 'test-session-token'
      }
    }

    mocked(getKey).mockResolvedValue('valid');

    // @ts-ignore
    mocked(jwt.verify).mockReturnValueOnce('valid').mockReturnValueOnce({ handle: 'validHandle' });
    mocked(getNewAddress).mockResolvedValue({ address: 'validAddress' });
    mocked(ActiveSessions.addActiveSession).mockResolvedValue(false);

    await sessionHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Sorry, this handle is being purchased! Try again later." });
  });

  it('should send a successful 200 response', async () => {
    mockRequest = {
      headers: {
        'x-access-token': 'test-access-token',
        'x-session-token': 'test-session-token'
      }
    }

    const validAddress = 'burrito_tacos123';
    const validHandle = 'taco';

    mocked(getKey).mockResolvedValue('valid');

    // @ts-ignore
    mocked(jwt.verify).mockReturnValueOnce('valid').mockReturnValueOnce({ handle: validHandle, emailAddress: '+1234567890', cost: 10 });
    mocked(getNewAddress).mockResolvedValue({ address: validAddress });
    const mockedAddActiveSession = mocked(ActiveSessions.addActiveSession).mockResolvedValue(true);

    await sessionHandler(mockRequest as Request, mockResponse as Response);

    expect(mockedAddActiveSession).toHaveBeenCalledWith({ "handle": validHandle, "wallet": { "address": validAddress }, emailAddress: '+1234567890', cost: 10, "start": expect.any(Number) });
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": false, "message": "Success! Session initiated.", "address": validAddress });
  });
});
