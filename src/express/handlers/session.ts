import * as express from "express";
import * as jwt from "jsonwebtoken";

import {
  HEADER_JWT_ACCESS_TOKEN,
  HEADER_JWT_SESSION_TOKEN
} from "../../helpers/constants";

import { isValid, normalizeNFTHandle } from "../../helpers/nft";
import { getKey } from "../../helpers/jwt";
import { getNewAddress } from "../../helpers/wallet";
import { ActiveSessions } from "../../models/firestore/collections/ActiveSession";
import { ActiveSession } from "../../models/ActiveSession";

interface SessionResponseBody {
  error: boolean,
  message?: string;
  address?: string;
}
interface SessionJWTPayload extends jwt.JwtPayload {
  emailAddress: string;
}

export const sessionHandler = async (req: express.Request, res: express.Response) => {
  const accessToken = req.headers[HEADER_JWT_ACCESS_TOKEN];
  const sessionToken = req.headers[HEADER_JWT_SESSION_TOKEN];

  if (!accessToken || !sessionToken) {
    return res.status(400).json({
      error: true,
      message: 'Must provide a valid access and session token.'
    } as SessionResponseBody);
  }

  const accessSecret = await getKey('access');
  const sessionSecret = await getKey('session');

  if (!sessionSecret || !accessSecret) {
    return res.status(500).json({
      error: true,
      message: 'Something went wrong with access secrets.'
    } as SessionResponseBody)
  }

  // Validate access token.
  const validAccessToken = jwt.verify(accessToken as string, accessSecret);
  if (!validAccessToken) {
    return res.status(403).json({
      error: true,
      message: 'Provided access token was invalid or expired.'
    } as SessionResponseBody);
  }

  // Validate session token.
  const sessionData = jwt.verify(sessionToken as string, sessionSecret) as SessionJWTPayload;
  // eslint-disable-next-line no-prototype-builtins
  if ('string' === typeof sessionData || !sessionData?.hasOwnProperty('handle')) {
    return res.status(403).json({
      error: true,
      message: 'Invalid session token.'
    })
  }

  // Normalize and validate handle.
  const handle = sessionData?.handle && normalizeNFTHandle(sessionData.handle);
  const validHandle = handle && isValid(handle);

  if (!handle || !validHandle) {
    return res.status(403).json({
      error: true,
      message: 'Invalid handle format.'
    } as SessionResponseBody);
  }

  const walletAddress = await getNewAddress();

  if (false === walletAddress) {
    return res.status(500).json({
      error: true,
      message: 'Failed to retrieve payment address data.',
    } as SessionResponseBody);
  }

  // Save session.
  const { emailAddress, cost, iat = Date.now() } = sessionData;
  const newSession = new ActiveSession({
    emailAddress,
    handle,
    wallet: walletAddress,
    cost,
    start: iat,
  });

  const added = await ActiveSessions.addActiveSession(newSession);

  if (!added) {
    const responseBody: SessionResponseBody = {
      error: true,
      message: 'Sorry, this handle is being purchased! Try again later.',
    };

    return res.status(400).json(responseBody);
  }

  return res.status(200).json({
    error: false,
    message: "Success! Session initiated.",
    address: walletAddress.address,
  } as SessionResponseBody);
};
