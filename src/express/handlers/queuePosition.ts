import * as express from "express";
import * as jwt from "jsonwebtoken";

import { HEADER_JWT_SESSION_TOKEN } from "../../helpers/constants";
import { getKey, SessionJWTPayload } from "../../helpers/jwt";

import { calculatePositionAndMinutesInQueue } from "../../helpers/utils";
import { StateData } from "../../models/firestore/collections/StateData";

interface QueuePositionResponseBody {
    error: boolean;
    accessQueuePosition: number;
    mintingQueuePosition: number;
    minutes: number;
    message?: string;
}

export const queuePositionHandler = async (req: express.Request, res: express.Response) => {
    const sessionToken = req.headers[HEADER_JWT_SESSION_TOKEN];

    if (!sessionToken) {
        return res.status(400).json({
            error: true,
            message: 'Must provide a valid session token.'
        } as QueuePositionResponseBody);
    }

    const sessionSecret = await getKey('session');

    if (!sessionSecret) {
        return res.status(500).json({
            error: true,
            message: 'Something went wrong with session token'
        } as QueuePositionResponseBody)
    }

    // Validate session token.
    const sessionData = jwt.verify(sessionToken as string, sessionSecret) as SessionJWTPayload;
    // eslint-disable-next-line no-prototype-builtins
    if ('string' === typeof sessionData || !sessionData?.hasOwnProperty('iat')) {
        return res.status(403).json({
            error: true,
            message: 'Invalid session token.'
        })
    }

    const { iat: userTimestamp } = sessionData as { iat: number };

    const {
        accessQueueSize,
        mintingQueueSize,
        accessQueueLimit,
        paidSessionsLimit,
        availableMintingServers,
        lastAccessTimestamp,
        lastMintingTimestamp } = await StateData.getStateData();

    const accessQueuePosition = calculatePositionAndMinutesInQueue(accessQueueSize, lastAccessTimestamp, userTimestamp, accessQueueLimit);
    const mintingQueuePosition = calculatePositionAndMinutesInQueue(mintingQueueSize, lastMintingTimestamp, userTimestamp, paidSessionsLimit * (availableMintingServers?.split(',').length || 1));

    return res.status(200).json({
        error: false,
        accessQueuePosition: accessQueuePosition.position,
        mintingQueuePosition: mintingQueuePosition.position,
        minutes: accessQueuePosition.minutes + mintingQueuePosition.minutes
    } as QueuePositionResponseBody);

}