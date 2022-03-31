import * as express from "express";
import { LogCategory, Logger } from "../../../helpers/Logger";
import { CHALLENGE_COMMAND, executeChildProcess } from "../../../helpers/executeChildProcess";
import { PoolProofs } from "../../../models/firestore/collections/PoolProofs";

interface SessionResponseBody {
    error: boolean,
    message?: string;
    address?: string;
}

interface ChallengeResult {
    status: string;
    domain: string;
    nonce: string;
}

const getLogMessage = (startTime: number) => ({ message: `challenge processed in ${Date.now() - startTime}ms`, event: 'challenge.run', milliseconds: Date.now() - startTime, category: LogCategory.METRIC });

export const challenge = async (req: express.Request, res: express.Response) => {
    try {
        const { bech32PoolId, cborHexEncodedVRFKey, hexEncodedVKeyHash } = req.body;

        const startTime = Date.now();

        const result = await executeChildProcess<ChallengeResult>(CHALLENGE_COMMAND);

        await PoolProofs.addPoolProof({ poolId: bech32PoolId, vrfKey: cborHexEncodedVRFKey, vKeyHash: hexEncodedVKeyHash, nonce: result.nonce });

        Logger.log(getLogMessage(startTime));

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
