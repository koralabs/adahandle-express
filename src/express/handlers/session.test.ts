/* eslint-disable @typescript-eslint/ban-ts-comment */
// disabling ban-ts-comment is only acceptable in tests. And it's recommend to use very little when you can.
import * as jwt from "jsonwebtoken";
import { Request, Response } from 'express';
import { sessionHandler } from "./session";
import * as jwtHelper from "../../helpers/jwt";
import * as walletHelper from "../../helpers/wallet";
import { ActiveSessions } from "../../models/firestore/collections/ActiveSession";
import { StakePools } from "../../models/firestore/collections/StakePools";
import { StakePool } from "../../models/StakePool";
import { CreatedBySystem } from "../../helpers/constants";
import { StateData } from "../../models/firestore/collections/StateData";
import { State } from "../../models/State";

jest.mock('jsonwebtoken');
jest.mock('../../helpers/jwt');
jest.mock('../../helpers/wallet');
jest.mock('../../models/firestore/collections/ActiveSession');
jest.mock('../../models/firestore/collections/StakePools');
jest.mock('../../models/firestore/collections/StateData');

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
    lastMintingTimestamp: 0,
    lastAccessTimestamp: 0,
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

    jest.spyOn(jwtHelper, 'getKey').mockResolvedValue(null);

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

    jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');

    // @ts-ignore
    jest.spyOn(jwt, 'verify').mockReturnValueOnce(null);

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

    jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');

    // @ts-ignore
    jest.spyOn(jwt, 'verify').mockReturnValueOnce('valid');

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

    jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');

    // @ts-ignore
    jest.spyOn(jwt, 'verify').mockReturnValueOnce('valid').mockReturnValueOnce({ handle: '!!NotValid!!' });

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

    jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');

    // @ts-ignore
    jest.spyOn(jwt, 'verify').mockReturnValueOnce('valid').mockReturnValueOnce({ handle: 'validHandle' });
    jest.spyOn(walletHelper, 'getNewAddress').mockResolvedValue(false);
    jest.spyOn(ActiveSessions, 'getActiveSessionsByEmail').mockResolvedValue([]);

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

    jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');

    // @ts-ignore
    jest.spyOn(jwt, 'verify').mockReturnValueOnce('valid').mockReturnValueOnce({ handle: 'validHandle' });
    jest.spyOn(walletHelper, 'getNewAddress').mockResolvedValue('validAddress');
    jest.spyOn(ActiveSessions, 'addActiveSession').mockResolvedValue(false);
    jest.spyOn(ActiveSessions, 'getActiveSessionsByEmail').mockResolvedValue([]);

    await sessionHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Sorry, this handle is being purchased! Try another handle." });
  });


  it('should send an 403 response if user has too many active sessions', async () => {
    mockRequest = {
      headers: {
        'x-access-token': 'test-access-token',
        'x-session-token': 'test-session-token'
      }
    }

    jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');

    // @ts-ignore
    jest.spyOn(jwt, 'verify').mockReturnValueOnce('valid').mockReturnValueOnce({ handle: 'validHandle' });
    const activeSessions = [{ handle: 'validHandle' }, { handle: 'validHandle' }, { handle: 'validHandle' }];
    // @ts-ignore
    jest.spyOn(ActiveSessions, 'getActiveSessionsByEmail').mockResolvedValue(activeSessions);

    await sessionHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Too many sessions open! Try again after one expires." });
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

    jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');

    // @ts-ignore
    jest.spyOn(jwt, 'verify').mockReturnValueOnce('valid').mockReturnValueOnce({ handle: validHandle, emailAddress: '+1234567890', cost: 10 });
    jest.spyOn(walletHelper, 'getNewAddress').mockResolvedValue(validAddress);
    jest.spyOn(ActiveSessions, 'getActiveSessionsByEmail').mockResolvedValue([]);
    jest.spyOn(StateData, 'getStateData').mockResolvedValue(stateData);
    const mockedAddActiveSession = jest.spyOn(ActiveSessions, 'addActiveSession').mockResolvedValue(true);

    await sessionHandler(mockRequest as Request, mockResponse as Response);

    expect(mockedAddActiveSession).toHaveBeenCalledWith({ "attempts": 0, "handle": validHandle, "paymentAddress": validAddress, emailAddress: '+1234567890', cost: 10000000, "start": expect.any(Number), "dateAdded": expect.any(Number), createdBySystem: "UI", status: 'pending' });
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({
      address: "burrito_tacos123",
      error: false,
      message: "Success! Session initiated."
    });
  });

  describe('SPO tests', () => {
    it('Should send 200 successful response', async () => {
      mockRequest = {
        headers: {
          'x-access-token': 'test-access-token',
          'x-session-token': 'test-session-token'
        }
      }

      const validAddress = 'burrito_tacos123';
      const validHandle = 'taco';

      jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');

      // @ts-ignore
      jest.spyOn(jwt, 'verify').mockReturnValueOnce('valid').mockReturnValueOnce({ handle: validHandle, emailAddress: '+1234567890', cost: 250, isSPO: true });
      jest.spyOn(StakePools, 'getStakePoolsByTicker').mockResolvedValue([new StakePool('1', validHandle, 'stakeKey_1', ['owner1', 'owner2'])]);
      jest.spyOn(StateData, 'getStateData').mockResolvedValue(stateData);
      const getNewAddressSpy = jest.spyOn(walletHelper, 'getNewAddress').mockResolvedValue(validAddress);
      const mockedAddActiveSession = jest.spyOn(ActiveSessions, 'addActiveSession').mockResolvedValue(true);

      await sessionHandler(mockRequest as Request, mockResponse as Response);

      expect(mockedAddActiveSession).toHaveBeenCalledWith({ "attempts": 0, "handle": validHandle, "paymentAddress": validAddress, emailAddress: '+1234567890', cost: 250000000, "start": expect.any(Number), "dateAdded": expect.any(Number), createdBySystem: "SPO", status: 'pending' });
      expect(getNewAddressSpy).toHaveBeenCalledWith(CreatedBySystem.SPO);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ "address": "burrito_tacos123", "error": false, "message": "Success! Session initiated." });
    });

    it('Should send 403 if handle does not exist', async () => {
      mockRequest = {
        headers: {
          'x-access-token': 'test-access-token',
          'x-session-token': 'test-session-token'
        }
      }

      const validHandle = 'taco';

      jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');

      // @ts-ignore
      jest.spyOn(jwt, 'verify').mockReturnValueOnce('valid').mockReturnValueOnce({ handle: validHandle, emailAddress: '+1234567890', cost: 250, isSPO: true });
      jest.spyOn(StakePools, 'getStakePoolsByTicker').mockResolvedValue([]);

      await sessionHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Stake pool not found. Please contact support." });
    });

    it('Should send 403 if there are more than 1 tickers for a handle', async () => {
      mockRequest = {
        headers: {
          'x-access-token': 'test-access-token',
          'x-session-token': 'test-session-token'
        }
      }

      jest.spyOn(jwtHelper, 'getKey').mockResolvedValue('valid');

      // @ts-ignore
      jest.spyOn(jwt, 'verify').mockReturnValueOnce('valid').mockReturnValueOnce({ handle: 'burrito', emailAddress: '+1234567890', cost: 250, isSPO: true });
      jest.spyOn(StakePools, 'getStakePoolsByTicker').mockResolvedValue([new StakePool('1', 'burrito', 'stakeKey_1', ['owner1', 'owner2']), new StakePool('2', 'burrito', 'stakeKey_2', ['owner3', 'owner4'])]);

      await sessionHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Ticker belongs to multiple stake pools. Please contact support." });
    });
  });
});
