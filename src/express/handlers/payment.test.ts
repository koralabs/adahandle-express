/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Request, Response } from 'express';
import { paymentConfirmedHandler } from './payment';
import { toLovelace } from '../../helpers/utils';
import { ActiveSessions } from '../../models/firestore/collections/ActiveSession';
import { ActiveSession, Status } from '../../models/ActiveSession';
import { CreatedBySystem } from '../../helpers/constants';

jest.mock('../../helpers/graphql');
jest.mock('../../models/firestore/collections/StakePools');
jest.mock('../../models/firestore/collections/ActiveSession');

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

  it('should send an 400 response if auth token is not provided', async () => {
    mockRequest = {
      query: {
        nope: 'nope'
      }
    }

    await paymentConfirmedHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "statusCode": "MISSING_PARAM" });
  });

  it('should send a successful 200 response', async () => {
    mockRequest = {
      query: {
        addresses: address,
      }
    }

    jest.spyOn(ActiveSessions, 'getByPaymentAddress').mockResolvedValue(new ActiveSession({
      emailAddress: '',
      cost: toLovelace(amount),
      handle: '',
      paymentAddress: '',
      start: 0,
      createdBySystem: CreatedBySystem.UI,
      status: Status.PAID,
    }));

    await paymentConfirmedHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": false, "items": [{ "address": "addr123", "statusCode": "CONFIRMED" }] });
  });

  // TODO: Test other responses
});
