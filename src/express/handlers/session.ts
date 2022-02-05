import * as express from "express";
import * as jwt from "jsonwebtoken";

import {
  HEADER_JWT_ACCESS_TOKEN,
  HEADER_JWT_SESSION_TOKEN,
  CreatedBySystem,
  SPO_HANDLE_ADA_COST,
  MAX_SESSION_COUNT
} from "../../helpers/constants";

import { isValid, normalizeNFTHandle } from "../../helpers/nft";
import { getKey, SessionJWTPayload } from "../../helpers/jwt";
import { getNewAddress } from "../../helpers/wallet";
import { ActiveSessions } from "../../models/firestore/collections/ActiveSession";
import { ActiveSession, Status } from "../../models/ActiveSession";
import { LogCategory, Logger } from "../../helpers/Logger";
import { StakePools } from "../../models/firestore/collections/StakePools";
import { toLovelace } from "../../helpers/utils";

interface SessionResponseBody {
  error: boolean,
  message?: string;
  address?: string;
}

export const sessionHandler = async (req: express.Request, res: express.Response) => {
  const startTime = Date.now();
  const getLogMessage = (startTime: number) => ({ message: `sessionHandler processed in ${Date.now() - startTime}ms`, event: 'sessionHandler.run', milliseconds: Date.now() - startTime, category: LogCategory.METRIC });
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
  const { emailAddress, cost, iat = Date.now(), isSPO = false } = sessionData;

  if (!handle || !validHandle) {
    return res.status(403).json({
      error: true,
      message: 'Invalid handle format.'
    } as SessionResponseBody);
  }

  // Save session.
  const newSession = new ActiveSession({
    emailAddress,
    handle,
    paymentAddress: '',
    cost: toLovelace(cost),
    start: iat,
    createdBySystem: CreatedBySystem.UI,
    status: Status.PENDING
  });

  /**
   * If the user is an SPO, we need to check if they have enough ADA to cover the cost of the session.
   * If not, we need to make sure they don't have too many sessions already.
   */
  if (isSPO) {
    // Set the session as SPO
    newSession.createdBySystem = CreatedBySystem.SPO;

    // Set the cost to the SPO cost
    newSession.cost = SPO_HANDLE_ADA_COST;

    // if SPO don't allow 1 letter handle?
    if (handle.length <= 1) {
      return res.status(403).json({
        error: true,
        message: 'Handle must be at least 3 characters long.'
      } as SessionResponseBody);
    }

    // check in most recent snapshot and verify SPO exists. If not, don't allow purchase.
    const uppercaseHandle = handle.toUpperCase();
    const stakePools = await StakePools.getStakePoolsByTicker(uppercaseHandle);

    if (stakePools.length === 0) {
      return res.status(403).json({
        error: true,
        message: 'Stake pool not found. Please contact support.'
      } as SessionResponseBody);
    }

    // Also determine if the ticker has more than 1 result. If so, don't allow purchase.
    if (stakePools.length > 1) {
      return res.status(403).json({
        error: true,
        message: 'Ticker belongs to multiple stake pools. Please contact support.'
      } as SessionResponseBody);
    }
  } else {
    const activeSessions = await ActiveSessions.getActiveSessionsByEmail(emailAddress);
    if (activeSessions.length > MAX_SESSION_COUNT) {
      return res.status(403).json({
        error: true,
        message: 'Too many sessions open! Try again after one expires.'
      } as SessionResponseBody);
    }
  }

  const walletAddress = await getNewAddress(newSession.createdBySystem);

  if (false === walletAddress) {
    return res.status(500).json({
      error: true,
      message: 'Failed to retrieve payment address data.',
    } as SessionResponseBody);
  }

  newSession.paymentAddress = walletAddress;
  const added = await ActiveSessions.addActiveSession(newSession);

  if (!added) {
    const responseBody: SessionResponseBody = {
      error: true,
      message: 'Sorry, this handle is being purchased! Try another handle.',
    };

    return res.status(400).json(responseBody);
  }

  Logger.log(getLogMessage(startTime))

  return res.status(200).json({
    error: false,
    message: "Success! Session initiated.",
    address: walletAddress,
  } as SessionResponseBody);
};
