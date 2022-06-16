import * as express from 'express';
import * as jwt from 'jsonwebtoken';
import { HEADER_UID } from '../../helpers/constants';

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

export const verifyWalletHandler: express.RequestHandler = async (req, res) => {
    const startTime = Date.now();
    const getLogMessage = (startTime: number) => ({
        message: `verifyWalletHandler processed in ${Date.now() - startTime}ms`,
        event: 'verifyWalletHandler.run',
        milliseconds: Date.now() - startTime,
        category: LogCategory.METRIC
    });

    if (!req.headers[HEADER_UID]) {
        return res.status(400).json({
            error: true,
            message: 'Unique identifier required'
        } as VerifyResponseBody);
    }

    const uid = req.headers[HEADER_UID] as string;

    try {
        const sessions = await ActiveSessions.getActiveSessionsUniqueId(uid);
        const activeSessions = sessions.map((session) => ({
            cost: session.cost,
            handle: session.handle,
            paymentAddress: session.paymentAddress,
            emailAddress: session.emailAddress
        }));

        const settings = await SettingsRepo.getSettings();
        const expireDateInSeconds = settings.accessWindowTimeoutMinutes * 60;

        const secretKey = await getKey('access');
        const token =
            secretKey &&
            jwt.sign(
                {
                    uid,
                    isSPO: false
                },
                secretKey,
                {
                    expiresIn: expireDateInSeconds
                }
            );

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
    } catch (e) {
        Logger.log({ message: JSON.stringify(e), category: LogCategory.ERROR });
        return res.status(500).json({
            error: true,
            message: 'Something went wrong with validation. Try again.'
        } as VerifyResponseBody);
    }
};
