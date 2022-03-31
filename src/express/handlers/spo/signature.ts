import * as express from "express";
import { LogCategory, Logger } from "../../../helpers/Logger";
import { PoolProofs } from "../../../models/firestore/collections/PoolProofs";

const getLogMessage = (startTime: number) => ({ message: `challenge processed in ${Date.now() - startTime}ms`, event: 'challenge.run', milliseconds: Date.now() - startTime, category: LogCategory.METRIC });

export const signature = async (req: express.Request, res: express.Response) => {
    try {
        const { bech32PoolId, signature } = req.body;

        const startTime = Date.now();

        await PoolProofs.updatePoolProof({ poolId: bech32PoolId, signature });

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
