import * as express from "express";
import * as jwt from "jsonwebtoken";

import { HEADER_PHONE, HEADER_PHONE_AUTH, MAX_ACCESS_LENGTH } from "../../helpers/constants";
import { removeAccessQueueData } from "../../helpers/firebase";
import { getKey } from "../../helpers/jwt";
import { getTwilioClient, getTwilioVerify } from "../../helpers/twilo";

interface VerifyResponseBody {
  error: boolean;
  token?: string;
  data?: jwt.JwtPayload;
  verified?: boolean;
  message?: string;
}

export const verifyHandler: express.RequestHandler = async (req, res) => {
  if (!req.headers[HEADER_PHONE]) {
    return res.status(400).json({
      error: true,
      message: 'Phone number required'
    } as VerifyResponseBody)
  }

  if (!req.headers[HEADER_PHONE_AUTH]) {
    return res.status(400).json({
      error: true,
      message: 'Missing phone authentication code.'
    } as VerifyResponseBody)
  }

  let token: string | null;
  try {
    const client = await getTwilioClient();
    const service = await getTwilioVerify();
    const { phoneNumber } = await client
      .lookups
      .phoneNumbers(req.headers[HEADER_PHONE] as string)
      .fetch()

    const status = await client
      .verify
      .services(service.sid)
      .verificationChecks
      .create({
        to: phoneNumber,
        code: req.headers[HEADER_PHONE_AUTH] as string
      })
      .then(res => res.status)
      .catch(e => console.log(e));

    if ('approved' !== status) {
      return res.status(403).json({
        verified: false,
        error: true,
        message: 'You either already used this auth code or you entered wrong information.'
      } as VerifyResponseBody)
    } else {
      // Remove the number from the access queue.
      await removeAccessQueueData(phoneNumber);

      const secretKey = await getKey('access');
      token = secretKey && jwt.sign(
        {
          /**
           * We have to put the phone number in the session's
           * JWT token so that we can accurately track concurrent
           * sessions across devices. We remove this at the end
           * of the session lifecycle, and set a corresponding
           * expirey on the local cookie.
           */
          phoneNumber
        },
        secretKey,
        {
          expiresIn: Math.floor(MAX_ACCESS_LENGTH / 1000)
        }
      );
    }
  } catch (e) {
    console.log(e);
    return res.status(500).json({
      error: true,
      message: 'Something went wrong with validation. Try again.'
    } as VerifyResponseBody);
  }

  return token && res.status(200).json({
    error: false,
    verified: true,
    token,
    data: jwt.decode(token)
  });
}
