import * as express from 'express';
import * as jwt from 'jsonwebtoken';

import { HEADER_EMAIL, HEADER_EMAIL_AUTH } from '../../helpers/constants';
import { removeAccessQueueData, getAccessQueueData } from '../../helpers/firebase';
import { getKey } from '../../helpers/jwt';
import { LogCategory, Logger } from '../../helpers/Logger';
import { ActiveSessions } from '../../models/firestore/collections/ActiveSession';
import { SettingsRepo } from '../../models/firestore/collections/SettingsRepo';

interface VerifyResponseBody {
    error: boolean;
    token?: string;
    data?: jwt.JwtPayload;
    verified?: boolean;
    message?: string;
}

export const verifyHandler: express.RequestHandler = async (req, res) => {
    const startTime = Date.now();
    const getLogMessage = (startTime: number) => ({
        message: `verifyHandler processed in ${Date.now() - startTime}ms`,
        event: 'verifyHandler.run',
        milliseconds: Date.now() - startTime,
        category: LogCategory.METRIC
    });
    if (!req.headers[HEADER_EMAIL]) {
        return res.status(400).json({
            error: true,
            message: 'Email address required'
        } as VerifyResponseBody);
    }

    const authCode = req.headers[HEADER_EMAIL_AUTH];

    if (!authCode) {
        return res.status(400).json({
            error: true,
            message: 'Missing email authentication code.'
        } as VerifyResponseBody);
    }

    let token: string | null;
    let activeSessions = [];
    try {
        const decodedAuth = Buffer.from(authCode as string, 'base64').toString('utf8');

        const ref = decodedAuth.split('|')[0];
        const email = decodedAuth.split('|')[1];

        const access = await getAccessQueueData(ref);

        if (!access || email != access.email) {
            await removeAccessQueueData(email);
            return res.status(403).json({
                verified: false,
                error: true,
                message: 'Invalid access code.'
            } as VerifyResponseBody);
        }

        const sessions = await ActiveSessions.getActiveSessionsByEmail(email);
        activeSessions = sessions.map((session) => ({
            cost: session.cost,
            handle: session.handle,
            paymentAddress: session.paymentAddress,
            emailAddress: session.emailAddress,
            status: session.status,
            createdBySystem: session.createdBySystem
        }));

        const settings = await SettingsRepo.getSettings();
        if ((access.start ?? 0) < Date.now() - settings.accessCodeTimeoutMinutes * 1000 * 60) {
            await removeAccessQueueData(email);
            return res.status(403).json({
                verified: false,
                error: true,
                message:
                    'Whoops! Your access window has expired. Please re-enter the queue. Make sure to turn on email notifications!'
            } as VerifyResponseBody);
        } else {
            // Remove the number from the access queue.
            await removeAccessQueueData(email);

            const expireDateInSeconds = settings.accessWindowTimeoutMinutes * 60;

            const secretKey = await getKey('access');
            token =
                secretKey &&
                jwt.sign(
                    {
                        /**
                         * We have to put the email address in the session's
                         * JWT token so that we can accurately track concurrent
                         * sessions across devices. We remove this at the end
                         * of the session lifecycle, and set a corresponding
                         * expirey on the local cookie.
                         */
                        emailAddress: email,
                        isSPO: false
                    },
                    secretKey,
                    {
                        expiresIn: expireDateInSeconds
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

    Logger.log(getLogMessage(startTime));

    res.cookie('sessionTimestamp', Date.now());
    return (
        token &&
        res.status(200).json({
            error: false,
            verified: true,
            token,
            data: jwt.decode(token),
            activeSessions
        })
    );
};
