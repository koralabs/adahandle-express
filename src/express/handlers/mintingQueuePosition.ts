import * as express from "express";
import * as jwt from "jsonwebtoken";

import { HEADER_JWT_ALL_SESSIONS_TOKEN } from "../../helpers/constants";
import { AllSessionsJWTPayload, getKey } from "../../helpers/jwt";

import { asyncForEach, calculatePositionAndMinutesInQueue } from "../../helpers/utils";
import { StateData } from "../../models/firestore/collections/StateData";
import { SettingsRepo } from "../../models/firestore/collections/SettingsRepo";
import { ActiveSessions } from "../../models/firestore/collections/ActiveSession";
import { ActiveSession, Status, WorkflowStatus } from "../../models/ActiveSession";

enum SessionStatusType {
    WAITING_FOR_PAYMENT = "WAITING_FOR_PAYMENT",
    WAITING_FOR_MINTING = "WAITING_FOR_MINTING",
    WAITING_FOR_CONFIRMATION = "WAITING_FOR_CONFIRMATION",
    CONFIRMED = "CONFIRMED",
    REFUNDED = "REFUNDED",
}

interface ActiveSessionWithDateAdded extends ActiveSession {
    dateAdded: number;
}

interface SessionStatus {
    mintingPosition?: {
        position: number;
        minutes: number;
    }
    handle: string;
    txId?: string;
    type: SessionStatusType;
    address: string;
}

interface QueuePositionResponseBody {
    error: boolean;
    sessions: SessionStatus[];
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

    const activeSessions: ActiveSessionWithDateAdded[] = [];

    await asyncForEach(sessionData.sessions, async (session) => {
        if (!session.address) {
            return;
        }

        const activeSession = await ActiveSessions.getByPaymentAddress(session.address);
        if (!activeSession) {
            return;
        }

        activeSessions.push({
            ...activeSession,
            dateAdded: session.dateAdded
        } as ActiveSessionWithDateAdded);
    });

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
    const sessionStatuses = activeSessions.reduce<SessionStatus[]>((memo, session) => {
        if (session.status === Status.PENDING) {
            memo.push({
                handle: session.handle,
                address: session.paymentAddress,
                type: SessionStatusType.WAITING_FOR_PAYMENT
            });
        } else if (session.status === Status.PAID && session.workflowStatus === WorkflowStatus.PENDING) {
            const mintingPosition = calculatePositionAndMinutesInQueue(mintingQueueSize, lastMintingTimestamp, session.dateAdded, paidSessionsLimit * (availableMintingServers?.split(',').length || 1));
            memo.push({
                handle: session.handle,
                address: session.paymentAddress,
                type: SessionStatusType.WAITING_FOR_MINTING,
                mintingPosition
            });
        } else if (session.status === Status.PAID && session.workflowStatus === WorkflowStatus.SUBMITTED) {
            memo.push({
                handle: session.handle,
                txId: session.txId,
                address: session.paymentAddress,
                type: SessionStatusType.WAITING_FOR_CONFIRMATION
            });
        } else if (session.status === Status.PAID && session.workflowStatus === WorkflowStatus.CONFIRMED) {
            memo.push({
                handle: session.handle,
                txId: session.txId,
                address: session.paymentAddress,
                type: SessionStatusType.CONFIRMED
            });
        } else if (session.status === Status.REFUNDABLE) {
            memo.push({
                handle: session.handle,
                address: session.paymentAddress,
                type: SessionStatusType.REFUNDED
            });
        }
        return memo;
    }, []);

    return res.status(200).json({
        error: false,
        sessions: sessionStatuses
    } as QueuePositionResponseBody);

}