import * as express from "express";
import { LogCategory, Logger } from "../../../helpers/Logger";
import { PoolProofs } from "../../../models/firestore/collections/PoolProofs";

const getLogMessage = (startTime: number) => ({ message: `verify processed in ${Date.now() - startTime}ms`, event: 'verify.run', milliseconds: Date.now() - startTime, category: LogCategory.METRIC });

export const verify = async (req: express.Request, res: express.Response) => {
    try {
        const { poolProof } = req.body;

        const startTime = Date.now();

        // Verify the proof is not greater than 5 minutes old

        // save the proof to a local file to use with CLI

        // create CLI command

        // execute CLI command

        // return true or false based on the result

        Logger.log(getLogMessage(startTime));

        return res.status(200).json({
            error: false,
        });
    } catch (error) {
        Logger.log({ message: JSON.stringify(error), category: LogCategory.ERROR });
        return res.status(500).json({
            error: true,
            message: "An error occurred.",
        });
    }
};
