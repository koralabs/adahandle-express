import * as express from "express";
import * as jwt from "jsonwebtoken";

import { HEADER_JWT_ALL_SESSIONS_TOKEN } from "../../helpers/constants";
import { AllSessionsJWTPayload, getKey } from "../../helpers/jwt";

import { calculatePositionAndMinutesInQueue } from "../../helpers/utils";
import { StateData } from "../../models/firestore/collections/StateData";

interface QueuePositionResponseBody {
    error: boolean;
    mintingQueuePosition: number;
    minutes: number;
    message?: string;
}

export const mintingQueuePositionHandler = async (req: express.Request, res: express.Response) => {
    const sessionToken = req.headers[HEADER_JWT_ALL_SESSIONS_TOKEN];

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
    const sessionData = jwt.verify(sessionToken as string, sessionSecret) as AllSessionsJWTPayload;
    // eslint-disable-next-line no-prototype-builtins
    if ('string' === typeof sessionData || !sessionData?.hasOwnProperty('sessions')) {
        return res.status(403).json({
            error: true,
            message: 'Invalid session token.'
        })
    }

    const {
        mintingQueueSize,
        paidSessionsLimit,
        availableMintingServers,
        lastMintingTimestamp } = await StateData.getStateData();

    const sessions = sessionData.sessions.filter(session => session.dateAdded > lastMintingTimestamp);
    // sort user sessions by date added
    sessions.sort((a, b) => a.dateAdded - b.dateAdded);

    const [session] = sessions;

    if (!session) {
        return res.status(404).json({
            error: true,
            message: 'No sessions found'
        })
    }


    const mintingQueuePosition = calculatePositionAndMinutesInQueue(mintingQueueSize, lastMintingTimestamp, session.dateAdded, paidSessionsLimit * (availableMintingServers?.split(',').length || 1));

    return res.status(200).json({
        error: false,
        mintingQueuePosition: mintingQueuePosition.position,
        minutes: mintingQueuePosition.minutes
    } as QueuePositionResponseBody);

}