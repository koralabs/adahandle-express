import * as express from "express";
import * as jwt from "jsonwebtoken";

import { HEADER_JWT_ALL_SESSIONS_TOKEN } from "../../helpers/constants";
import { AllSessionsJWTPayload, getKey } from "../../helpers/jwt";

import { calculatePositionAndMinutesInQueue } from "../../helpers/utils";
import { StateData } from "../../models/firestore/collections/StateData";
import { SettingsRepo } from "../../models/firestore/collections/SettingsRepo";
import { ActiveSessions } from "../../models/firestore/collections/ActiveSession";
import { ActiveSession, Status, WorkflowStatus } from "../../models/ActiveSession";

interface SessionStatus extends ActiveSession {
    dateAdded: number;
    mintingPosition?: {
        position: number;
        minutes: number;
    }
}

interface SessionsStatuses {
    waitingForPayment: SessionStatus[];
    waitingForMinting: SessionStatus[];
    waitingForConfirmation: SessionStatus[];
    confirmed: SessionStatus[];
}

interface QueuePositionResponseBody {
    error: boolean;
    sessions: SessionsStatuses;
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
    if (!sessionData.sessions || sessionData.sessions.length === 0) {
        return res.status(200).json({
            error: false,
            mintingQueuePosition: 0,
            minutes: 0
        })
    }

    // get all session handles
    const activeSessions = await Promise.all(sessionData.sessions.map(async session => {
        const activeSession = await ActiveSessions.getByHandle(session.handle);
        return {
            ...activeSession[0],
            dateAdded: session.dateAdded
        } as SessionStatus;
    }));

    const [stateData, settingsData] = await Promise.all([
        StateData.getStateData(),
        SettingsRepo.getSettings()
    ]);

    const { mintingQueueSize, lastMintingTimestamp } = stateData;
    const { paidSessionsLimit, availableMintingServers } = settingsData;

    // figure out what sessions are
    // - waiting to be paid
    // - paid but waiting to be minted
    // - minted but not yet confirmed
    // - confirmed
    const sessionStatuses = activeSessions.flat().reduce<SessionsStatuses>((memo, session) => {
        if (session.status === Status.PENDING) {
            memo.waitingForPayment.push(session);
        } else if (session.status === Status.PAID && session.workflowStatus === WorkflowStatus.PENDING) {
            const mintingPosition = calculatePositionAndMinutesInQueue(mintingQueueSize, lastMintingTimestamp, session.dateAdded, paidSessionsLimit * (availableMintingServers?.split(',').length || 1));
            memo.waitingForMinting.push({ ...session, mintingPosition } as SessionStatus);
        } else if (session.status === Status.PAID && session.workflowStatus === WorkflowStatus.SUBMITTED) {
            memo.waitingForConfirmation.push(session);
        } else if (session.status === Status.PAID && session.workflowStatus === WorkflowStatus.CONFIRMED) {
            memo.confirmed.push(session);
        }
        return memo;
    }, {
        waitingForPayment: [],
        waitingForMinting: [],
        waitingForConfirmation: [],
        confirmed: []
    });

    return res.status(200).json({
        error: false,
        sessions: sessionStatuses
    } as QueuePositionResponseBody);

}