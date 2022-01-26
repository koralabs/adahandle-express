/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Request, Response } from 'express';
import { StakePools } from "../../models/firestore/collections/StakePools";
import { CreatedBySystem } from "../../helpers/constants";
import { paymentConfirmedHandler } from './payment';
import * as graphql from '../../helpers/graphql';
import { PaidSessions } from "../../models/firestore/collections/PaidSessions";
import { PaidSession } from "../../models/PaidSession";
import { toLovelace } from '../../helpers/utils';

jest.mock('../../helpers/graphql');
jest.mock('../../models/firestore/collections/StakePools');
jest.mock('../../models/firestore/collections/PaidSessions');

describe('Payment Tests', () => {
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


  const address = 'addr123';
  const amount = 20;
  const returnAddress = 'returnAddr123';

  const WalletSimplifiedBalanceFixture = {
    address,
    amount: toLovelace(amount),
    returnAddress
  }

  it('should send an 400 response if auth token is not provided', async () => {
    mockRequest = {
      query: {
        nope: 'nope'
      }
    }

    await paymentConfirmedHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Missing addresses query parameter." });
  });

  it('should send a successful 200 response', async () => {
    mockRequest = {
      query: {
        addresses: address,
      }
    }

    jest.spyOn(graphql, 'checkPayments').mockResolvedValue([WalletSimplifiedBalanceFixture]);

    await paymentConfirmedHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({ "addresses": [{ "address": "addr123", "amount": 20000000, "returnAddress": "returnAddr123" }], "error": false });
  });
});
