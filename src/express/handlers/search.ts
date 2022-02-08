import * as express from "express";
import * as jwt from "jsonwebtoken";
import { HEADER_HANDLE, HEADER_JWT_ACCESS_TOKEN, MAX_SESSION_COUNT } from "../../helpers/constants";
import { AccessJWTPayload, getKey } from "../../helpers/jwt";
import { LogCategory, Logger } from "../../helpers/Logger";
import { ActiveSessions } from "../../models/firestore/collections/ActiveSession";
import { HandleAvailabilityResponse, ReservedHandles } from "../../models/firestore/collections/ReservedHandles";
import { StakePools } from "../../models/firestore/collections/StakePools";

interface SearchResponseBody {
    error: boolean;
    message?: string;
    response?: HandleAvailabilityResponse
}

export const searchHandler = async (req: express.Request, res: express.Response) => {
    try {
        const startTime = Date.now();
        const getLogMessage = (startTime: number) => ({ message: `searchHandler processed in ${Date.now() - startTime}ms`, event: 'searchHandler.run', milliseconds: Date.now() - startTime, category: LogCategory.METRIC });
        const accessToken = req.headers[HEADER_JWT_ACCESS_TOKEN];
        const handle = req.headers[HEADER_HANDLE] as string;

        if (!accessToken) {
            return res.status(400).json({
                error: true,
                message: 'Must provide a valid access and session token.'
            } as SearchResponseBody);
        }

        const accessSecret = await getKey('access');

        if (!accessSecret) {
            return res.status(500).json({
                error: true,
                message: 'Something went wrong with access secrets.'
            } as SearchResponseBody)
        }

        // Validate access token.
        const validAccessToken = jwt.verify(accessToken as string, accessSecret) as AccessJWTPayload;
        if (!validAccessToken) {
            return res.status(403).json({
                error: true,
                message: 'Provided access token was invalid or expired.'
            } as SearchResponseBody);
        }

        const { emailAddress, isSPO = false } = validAccessToken;

        if (isSPO) {
            const uppercaseHandle = handle.toUpperCase();
            const stakePools = await StakePools.getStakePoolsByTicker(uppercaseHandle);
            if (stakePools.length === 0) {
                return res.status(403).json({
                    error: true,
                    message: 'Stake pool not found. Send an email to private@adahandle.com if you believe this is incorrect.'
                } as SearchResponseBody);
            }

            // Determine if the ticker has more than 1 result. If so, don't allow
            if (stakePools.length > 1) {
                return res.status(403).json({
                    error: true,
                    message: 'Ticker belongs to multiple stake pools. Send an email to private@adahandle.com.'
                });
            }
        } else {
            const activeSessions = await ActiveSessions.getActiveSessionsByEmail(emailAddress);
            if (activeSessions.length >= MAX_SESSION_COUNT) {
                return res.status(403).json({
                    error: true,
                    message: 'Too many sessions open! Try again after one expires.'
                } as SearchResponseBody);
            }
        }

        const response = await ReservedHandles.checkAvailability(handle);
        res.status(200).json({
            error: false,
            message: "Success!",
            response,
        } as SearchResponseBody);

        Logger.log(getLogMessage(startTime))
    } catch (error) {
        return res.status(500).json({
            error: true,
            message: "An error occurred.",
        } as SearchResponseBody);
    }
}