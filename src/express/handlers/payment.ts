import * as express from "express";
import { checkPayments } from '../../helpers/graphql';
import { Logger, LogCategory } from '../../helpers/Logger';


interface PaymentResponseBody {
  error: boolean;
  message?: string;
  addresses: {
    address: string;
    amount: number;
  }[];
}

export const paymentConfirmedHandler = async (req: express.Request, res: express.Response) => {
  const startTime = Date.now();
  const getLogMessage = (startTime: number) => ({ message: `paymentConfirmedHandler processed in ${Date.now() - startTime}ms`, event: 'paymentConfirmedHandler.run', milliseconds: Date.now() - startTime, category: LogCategory.METRIC });
  if (!req.query.addresses) {
    return res.status(400).json({
      error: true,
      message: "Missing addresses query parameter."
    } as PaymentResponseBody);
  }

  try {
    // TODO: Fix this to account for accurate payment from an SPO
    const addresses = await checkPayments((req.query.addresses as string).split(','))
    Logger.log(getLogMessage(startTime))
    return res.status(200).json({
      error: false,
      addresses
    });
  } catch (e) {
    Logger.log({ category: LogCategory.ERROR, message: JSON.stringify(e), event: 'paymentConfirmedHandler.run' })
    return res.status(500).json({
      error: true,
      message: e
    })
  }
}
