/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Request, Response } from 'express';
import { StakePools } from "../../models/firestore/collections/StakePools";
import { CreatedBySystem } from "../../helpers/constants";
import { paymentConfirmedHandler, ConfirmPaymentStatusCode } from './payment';
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

  const paidSessionFixture = new PaidSession({
    emailAddress: "",
    cost: amount,
    handle: "",
    start: 0,
    attempts: 0,
    paymentAddress: address,
    returnAddress,
    dateAdded: 0,
    createdBySystem: CreatedBySystem.UI,
  })

  it('should send an 400 response if auth token is not provided', async () => {
    mockRequest = {
      query: {
        nope: 'nope'
      }
    }

    await paymentConfirmedHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: true, statusCode: ConfirmPaymentStatusCode.MISSING_PARAM });
  });

  it('should send a successful 200 response', async () => {
    mockRequest = {
      query: {
        addresses: address,
      }
    }

    jest.spyOn(graphql, 'checkPayments').mockResolvedValue([WalletSimplifiedBalanceFixture]);
    jest.spyOn(PaidSessions, 'getPaidSessionByWalletAddress').mockResolvedValue(paidSessionFixture);
    jest.spyOn(StakePools, 'verifyReturnAddressOwnsStakePool').mockResolvedValue(false);


    await paymentConfirmedHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: false, items: [{ address, statusCode: ConfirmPaymentStatusCode.CONFIRMED }] });
  });

  it('should send a 200 response when there are no payments on chain', async () => {
    const address = 'addr123';

    mockRequest = {
      query: {
        addresses: address,
      }
    }

    jest.spyOn(graphql, 'checkPayments').mockResolvedValue([]);

    await paymentConfirmedHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: false, statusCode: ConfirmPaymentStatusCode.NO_PAYMENTS_FOUND_ON_CHAIN });
  });

  it('should send bad state if session if paid session is not found', async () => {
    const address = 'addr123';

    mockRequest = {
      query: {
        addresses: address,
      }
    }

    jest.spyOn(graphql, 'checkPayments').mockResolvedValue([WalletSimplifiedBalanceFixture]);
    jest.spyOn(PaidSessions, 'getPaidSessionByWalletAddress').mockResolvedValue(null);

    await paymentConfirmedHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: false, items: [{ address, statusCode: ConfirmPaymentStatusCode.BAD_STATE }] });
  });

  it('should send invalid payment if amount is incorrect', async () => {
    const address = 'addr123';

    mockRequest = {
      query: {
        addresses: address,
      }
    }

    jest.spyOn(graphql, 'checkPayments').mockResolvedValue([WalletSimplifiedBalanceFixture]);

    const invalidAmountPaidSession = new PaidSession({ ...paidSessionFixture, cost: amount - 1 });
    jest.spyOn(PaidSessions, 'getPaidSessionByWalletAddress').mockResolvedValue(invalidAmountPaidSession);

    await paymentConfirmedHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: false, items: [{ address, statusCode: ConfirmPaymentStatusCode.INVALID_PAYMENT }] });
  });

  describe('SPO tests', () => {
    it('should send invalid payment if amount is correct and is not the SPO owner', async () => {
      mockRequest = {
        query: {
          addresses: address,
        }
      }

      jest.spyOn(graphql, 'checkPayments').mockResolvedValue([WalletSimplifiedBalanceFixture]);
      const spoPaidSession = new PaidSession({ ...paidSessionFixture, createdBySystem: CreatedBySystem.SPO });
      jest.spyOn(PaidSessions, 'getPaidSessionByWalletAddress').mockResolvedValue(spoPaidSession);
      jest.spyOn(StakePools, 'verifyReturnAddressOwnsStakePool').mockResolvedValue(false);

      await paymentConfirmedHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: false, items: [{ address, statusCode: ConfirmPaymentStatusCode.INVALID_PAYMENT_SPO }] });
    });

    it('should send valid payment if amount is correct and is the SPO owner', async () => {
      mockRequest = {
        query: {
          addresses: address,
        }
      }

      jest.spyOn(graphql, 'checkPayments').mockResolvedValue([WalletSimplifiedBalanceFixture]);
      const spoPaidSession = new PaidSession({ ...paidSessionFixture, createdBySystem: CreatedBySystem.SPO });
      jest.spyOn(PaidSessions, 'getPaidSessionByWalletAddress').mockResolvedValue(spoPaidSession);
      jest.spyOn(StakePools, 'verifyReturnAddressOwnsStakePool').mockResolvedValue(true);

      await paymentConfirmedHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: false, items: [{ address, statusCode: ConfirmPaymentStatusCode.CONFIRMED }] });
    });
  });
});
