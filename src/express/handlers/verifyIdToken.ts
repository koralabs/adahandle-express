import * as express from "express";
import * as jwt from "jsonwebtoken";

import {
    HEADER_ID_TOKEN,
    HEADER_JWT_ACCESS_TOKEN,
    HEADER_JWT_SPO_ACCESS_TOKEN
} from "../../helpers/constants";

import { getKey } from "../../helpers/jwt";
import { LogCategory, Logger } from "../../helpers/Logger";
import { verifyTwitterUser } from "../../helpers/firebase";

interface SessionResponseBody {
    error: boolean,
    message?: string;
    address?: string;
}

export const verifyIdTokenHandler = async (req: express.Request, res: express.Response) => {
    try {
        const startTime = Date.now();
        const getLogMessage = (startTime: number) => ({ message: `verifyIdTokenHandler processed in ${Date.now() - startTime}ms`, event: 'verifyIdTokenHandler.run', milliseconds: Date.now() - startTime, category: LogCategory.METRIC });
        const accessToken = req.headers[HEADER_JWT_ACCESS_TOKEN] ?? req.headers[HEADER_JWT_SPO_ACCESS_TOKEN];
        const idToken = req.headers[HEADER_ID_TOKEN];

        if (!accessToken || !idToken) {
            return res.status(400).json({
                error: true,
                message: 'Must provide a valid access and id token.'
            } as SessionResponseBody);
        }

        const accessSecret = await getKey('access');
        if (!accessSecret) {
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

        const result = await verifyTwitterUser(idToken as string);

        Logger.log(getLogMessage(startTime))

        return res.status(200).json({
            error: false,
            message: `Token verification ${result ? 'successful' : 'failed'}`,
            tokenResult: result
        });
    } catch (error) {
        Logger.log({ message: JSON.stringify(error), category: LogCategory.ERROR });
        return res.status(500).json({
            error: true,
            message: "An error occurred.",
        });
    }
};
