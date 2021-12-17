import * as express from "express";
import * as jwt from "jsonwebtoken";

import { HEADER_EMAIL, HEADER_EMAIL_AUTH, MAX_ACCESS_LENGTH } from "../../helpers/constants";
import { removeAccessQueueData } from "../../helpers/firebase";
import { getKey } from "../../helpers/jwt";
import { getTwilioClient, getTwilioVerify } from "../../helpers/twilo";
import { LogCategory, Logger } from "../../helpers/Logger";

interface VerifyResponseBody {
  error: boolean;
  token?: string;
  data?: jwt.JwtPayload;
  verified?: boolean;
  message?: string;
}

export const verifyHandler: express.RequestHandler = async (req, res) => {
  const startTime = Date.now();
  const getLogMessage = (startTime: number) => ({ message: `verifyHandler processed in ${Date.now() - startTime}ms`, event: 'verifyHandler.run', milliseconds: Date.now() - startTime, category: LogCategory.METRIC });
  if (!req.headers[HEADER_EMAIL]) {
    return res.status(400).json({
      error: true,
      message: 'Email address required'
    } as VerifyResponseBody)
  }

  if (!req.headers[HEADER_EMAIL_AUTH]) {
    return res.status(400).json({
      error: true,
      message: 'Missing email authentication code.'
    } as VerifyResponseBody)
  }

  let token: string | null;
  try {
    const email = req.headers[HEADER_EMAIL] as string;
    const client = getTwilioClient();
    const service = await getTwilioVerify();

    const status = await client
      .verify
      .services(service.sid)
      .verificationChecks
      .create({
        to: email,
        code: req.headers[HEADER_EMAIL_AUTH] as string,
      })
      .then(res => res.status)
      .catch(e => Logger.log(JSON.stringify({
        email,
        auth: req.headers[HEADER_EMAIL_AUTH],
        sid: service.sid,
        e
      })));

    if ('approved' !== status) {
      return res.status(403).json({
        verified: false,
        error: true,
        message: 'Whoops! Your access window has expired. Please re-enter the queue. Make sure to turn on email notifications!'
      } as VerifyResponseBody)
    } else {
      // Remove the number from the access queue.
      await removeAccessQueueData(email);

      const secretKey = await getKey('access');
      token = secretKey && jwt.sign(
        {
          /**
           * We have to put the email address in the session's
           * JWT token so that we can accurately track concurrent
           * sessions across devices. We remove this at the end
           * of the session lifecycle, and set a corresponding
           * expirey on the local cookie.
           */
          emailAddress: email
        },
        secretKey,
        {
          expiresIn: Math.floor(MAX_ACCESS_LENGTH / 1000)
        }
      );
    }
  } catch (e) {
    Logger.log({ message: JSON.stringify(e), category: LogCategory.ERROR });
    return res.status(500).json({
      error: true,
      message: 'Something went wrong with validation. Try again.'
    } as VerifyResponseBody);
  }

  Logger.log(getLogMessage(startTime))

  return token && res.status(200).json({
    error: false,
    verified: true,
    token,
    data: jwt.decode(token)
  });
}
