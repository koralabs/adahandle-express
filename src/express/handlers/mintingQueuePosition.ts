import * as express from "express";
import * as jwt from "jsonwebtoken";

import { HEADER_JWT_ALL_SESSIONS_TOKEN } from "../../helpers/constants";
import { AllSessionsJWTPayload, getKey } from "../../helpers/jwt";

import { calculatePositionAndMinutesInQueue } from "../../helpers/utils";
import { StateData } from "../../models/firestore/collections/StateData";
import { SettingsRepo } from "../../models/firestore/collections/SettingsRepo";
import { ActiveSessions } from "../../models/firestore/collections/ActiveSession";
import { ActiveSession, Status, WorkflowStatus } from "../../models/ActiveSession";

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

    // Bounce out
    if (!sessionData.session || sessionData.sessions.length === 0) {
        return res.status(200).json({
            error: false,
            mintingQueuePosition: 0,
            minutes: 0
        })
    }

    const {
        mintingQueueSize,
        lastMintingTimestamp } = await StateData.getStateData();
    const {
        paidSessionsLimit,
        availableMintingServers,
    } = await SettingsRepo.getSettings();

    // get all session handles
    const activeSessions = await Promise.all(sessionData.sessions.map(session => ActiveSessions.getByHandle(session.handle)));

    // figure out what sessions are
    // - waiting to be paid
    // - paid but waiting to be minted
    // - minted but not yet confirmed
    // - confirmed
    const sessionStatuses = activeSessions.flat().reduce((memo, session) => {
        if (session.status === Status.PENDING) {
            memo.waitingForPayment.push(session);
        } else if (session.status === Status.PAID && session.workflowStatus === WorkflowStatus.PENDING) {
            memo.waitingForMinting.push(session);
        } else if (session.status === Status.PAID && session.workflowStatus === WorkflowStatus.SUBMITTED) {
            memo.waitingForConfirmation.push(session);
        } else if (session.status === Status.PAID && session.workflowStatus === WorkflowStatus.CONFIRMED) {
            memo.confirmed.push(session);
        }
        return memo;
    }, {
        waitingForPayment: [] as ActiveSession[],
        waitingForMinting: [] as ActiveSession[],
        waitingForConfirmation: [] as ActiveSession[],
        confirmed: [] as ActiveSession[]
    });

    // figure out if we can 

    // const mintingQueuePosition = calculatePositionAndMinutesInQueue(mintingQueueSize, lastMintingTimestamp, session.dateAdded, paidSessionsLimit * (availableMintingServers?.split(',').length || 1));

    return res.status(200).json({
        error: false,
        mintingQueuePosition: mintingQueuePosition.position,
        minutes: mintingQueuePosition.minutes
    } as QueuePositionResponseBody);

}