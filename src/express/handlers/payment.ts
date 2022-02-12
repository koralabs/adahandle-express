import * as express from "express";
import { CreatedBySystem } from "../../helpers/constants";
import { Logger, LogCategory } from '../../helpers/Logger';
import { Status } from "../../models/ActiveSession";
import { ActiveSessions } from "../../models/firestore/collections/ActiveSession";

export enum ConfirmPaymentStatusCode {
  CONFIRMED = 'CONFIRMED',
  INVALID_PAYMENT = 'INVALID_PAYMENT',
  INVALID_PAYMENT_SPO = 'INVALID_PAYMENT_SPO',
  SERVER_ERROR = 'SERVER_ERROR',
  MISSING_PARAM = 'MISSING_PARAM',
  PENDING = 'PENDING',
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

const buildPaymentConfirmResponses = async (address: string): Promise<PaymentConfirmedItem> => {
  const session = await ActiveSessions.getByWalletAddress(address);
  if (!session) {
    // if there is a transaction, we should always have a paid session
    Logger.log({ message: `No paid session found for ${address}`, event: 'buildPaymentConfirmResponses.noPaidSession', category: LogCategory.NOTIFY });
    return {
      statusCode: ConfirmPaymentStatusCode.BAD_STATE,
      address
    };
  }

  const { createdBySystem, status } = session;
  if (status === Status.PENDING) {
    return {
      statusCode: ConfirmPaymentStatusCode.PENDING,
      address
    };
  }

  if (status === Status.REFUNDABLE || status === Status.DLQ) {
    if (createdBySystem === CreatedBySystem.SPO) {
      return {
        statusCode: ConfirmPaymentStatusCode.INVALID_PAYMENT_SPO,
        address,
      };
    }

    return {
      statusCode: ConfirmPaymentStatusCode.INVALID_PAYMENT,
      address,
    };
  }

  return {
    statusCode: ConfirmPaymentStatusCode.CONFIRMED,
    address,
  };
};

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

    // determine if the payments are valid.
    const paymentResponse = splitAddresses.map(address => buildPaymentConfirmResponses(address));
    const items = await Promise.all(paymentResponse);

    Logger.log(getLogMessage(startTime))
    return res.status(200).json({ error: false, items } as PaymentConfirmedResponse);
  } catch (e) {
    Logger.log({ category: LogCategory.ERROR, message: JSON.stringify(e), event: 'paymentConfirmedHandler.run' })
    return res.status(500).json({
      error: true,
      statusCode: ConfirmPaymentStatusCode.SERVER_ERROR
    })
  }
}
