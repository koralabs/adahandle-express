import * as express from "express";
import { checkPayments } from '../../helpers/graphql';


interface PaymentResponseBody {
  error: boolean;
  message?: string;
  addresses: {
    address: string;
    amount: number;
  }[];
}

export const paymentConfirmedHandler = async (req: express.Request, res: express.Response) => {
  if (!req.query.addresses) {
    return res.status(400).json({
      error: true,
      message: "Missing addresses query parameter."
    } as PaymentResponseBody);
  }

  try {
    const addresses = await checkPayments((req.query.addresses as string).split(','))
    return res.status(200).json({
      error: false,
      addresses
    });
  } catch (e) {
    return res.status(500).json({
      error: true,
      message: e
    })
  }
}
