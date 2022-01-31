import * as express from "express";
import { CreatedBySystem } from "../../helpers/constants";
import { checkPayments, WalletSimplifiedBalance } from '../../helpers/graphql';
import { Logger, LogCategory } from '../../helpers/Logger';
import { ActiveSessions } from "../../models/firestore/collections/ActiveSession";
import { StakePools } from "../../models/firestore/collections/StakePools";

export enum ConfirmPaymentStatusCode {
  CONFIRMED = 'CONFIRMED',
  INVALID_PAYMENT = 'INVALID_PAYMENT',
  INVALID_PAYMENT_SPO = 'INVALID_PAYMENT_SPO',
  SERVER_ERROR = 'SERVER_ERROR',
  MISSING_PARAM = 'MISSING_PARAM',
  NO_PAYMENTS_FOUND_ON_CHAIN = 'NO_PAYMENTS_FOUND_ON_CHAIN',
  BAD_STATE = 'BAD_STATE'
}

interface PaymentConfirmedItem {
  statusCode: ConfirmPaymentStatusCode;
  address: string;
}

interface PaymentConfirmedResponse {
  error: boolean;
  statusCode?: ConfirmPaymentStatusCode;
  items?: PaymentConfirmedItem[];
}

const buildPaymentConfirmResponses = async (onChainPayments: WalletSimplifiedBalance[]): Promise<PaymentConfirmedItem[]> => {
  const responses = onChainPayments.map(async onChainPayment => {
    const { address, amount, returnAddress } = onChainPayment;
    const session = await ActiveSessions.getByWalletAddress(address);
    if (!session) {
      // if there is a transaction, we should always have a paid session
      Logger.log({ message: `No paid session found for ${address}`, event: 'buildPaymentConfirmResponses.noPaidSession', category: LogCategory.NOTIFY });
      return {
        statusCode: ConfirmPaymentStatusCode.BAD_STATE,
        address
      };
    }

    const { cost, createdBySystem, handle } = session;
    if (amount === cost) {
      if (createdBySystem === CreatedBySystem.SPO) {
        const isStakePoolOwner = await StakePools.verifyReturnAddressOwnsStakePool(returnAddress, handle);
        if (!isStakePoolOwner) {
          return {
            statusCode: ConfirmPaymentStatusCode.INVALID_PAYMENT_SPO,
            address,
          };
        }
      }

      // Since payment is not from an SPO, it is a valid payment
      return {
        statusCode: ConfirmPaymentStatusCode.CONFIRMED,
        address,
      };
    }

    // payments doesn't match, send invalid payment
    return {
      statusCode: ConfirmPaymentStatusCode.INVALID_PAYMENT,
      address,
    };
  });

  return Promise.all(responses);
};

const isEmptyResult = (onChainPayments: WalletSimplifiedBalance[]): boolean => {
  return onChainPayments.length === 1 && onChainPayments[0].amount === 0 && onChainPayments[0].returnAddress === '';
}

export const paymentConfirmedHandler = async (req: express.Request, res: express.Response) => {
  const startTime = Date.now();
  const getLogMessage = (startTime: number) => ({ message: `paymentConfirmedHandler processed in ${Date.now() - startTime}ms`, event: 'paymentConfirmedHandler.run', milliseconds: Date.now() - startTime, category: LogCategory.METRIC });
  if (!req.query.addresses) {
    return res.status(400).json({
      error: true,
      statusCode: ConfirmPaymentStatusCode.MISSING_PARAM
    } as PaymentConfirmedResponse);
  }

  try {
    const splitAddresses = (req.query.addresses as string).split(',');
    const onChainPayments = await checkPayments(splitAddresses);

    if (onChainPayments.length === 0 || isEmptyResult(onChainPayments)) {
      return res.status(200).json({
        error: false,
        statusCode: ConfirmPaymentStatusCode.NO_PAYMENTS_FOUND_ON_CHAIN
      } as PaymentConfirmedResponse);
    }

    // determine if the payments are valid.
    const paymentResponse = await buildPaymentConfirmResponses(onChainPayments);

    Logger.log(getLogMessage(startTime))
    return res.status(200).json({ error: false, items: paymentResponse } as PaymentConfirmedResponse);
  } catch (e) {
    Logger.log({ category: LogCategory.ERROR, message: JSON.stringify(e), event: 'paymentConfirmedHandler.run' })
    return res.status(500).json({
      error: true,
      statusCode: ConfirmPaymentStatusCode.SERVER_ERROR
    })
  }
}
