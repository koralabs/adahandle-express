import * as express from "express";
import * as jwt from "jsonwebtoken";
import { LogCategory, Logger } from "../../../helpers/Logger";
import { runChallengeCommand } from "../../../helpers/executeChildProcess";
import { PoolProofs } from "../../../models/firestore/collections/PoolProofs";
import { verifyIsAlphaNumeric, verifyIsPoolId } from "../../../helpers/utils";
import { HEADER_JWT_SPO_ACCESS_TOKEN } from "../../../helpers/constants";
import { getKey } from "../../../helpers/jwt";
import { StakePools } from "../../../models/firestore/collections/StakePools";
import { ReservedHandles } from "../../../models/firestore/collections/ReservedHandles";

interface ChallengeResult {
    status: string;
    domain: string;
    nonce: string;
}

export interface SpoChallengeResponseBody {
    error: boolean,
    message: string;
    handle?: string;
    challengeResult?: ChallengeResult;
}

const getLogMessage = (startTime: number) => ({ message: `challenge processed in ${Date.now() - startTime}ms`, event: 'challenge.run', milliseconds: Date.now() - startTime, category: LogCategory.METRIC });

export const challengeHandler = async (req: express.Request, res: express.Response) => {
    try {
        const startTime = Date.now();
        const accessToken = req.headers[HEADER_JWT_SPO_ACCESS_TOKEN];

        if (!accessToken) {
            return res.status(400).json({
                error: true,
                message: 'Must provide a valid access and id token.'
            });
        }

        const accessSecret = await getKey('access');
        if (!accessSecret) {
            return res.status(500).json({
                error: true,
                message: 'Something went wrong with access secrets.'
            })
        }

        const validAccessToken = jwt.verify(accessToken as string, accessSecret);
        if (!validAccessToken) {
            return res.status(403).json({
                error: true,
                message: 'Provided access token was invalid or expired.'
            });
        }

        const { bech32PoolId, cborHexEncodedVRFKey, hexEncodedVKeyHash } = req.body;

        if (!bech32PoolId || !cborHexEncodedVRFKey || !hexEncodedVKeyHash) {
            return res.status(400).json({
                error: true,
                message: 'Missing required parameters.'
            });
        }

        // verify incoming parameters
        if (!verifyIsPoolId(bech32PoolId) || !verifyIsAlphaNumeric(cborHexEncodedVRFKey) || !verifyIsAlphaNumeric(hexEncodedVKeyHash)) {
            return res.status(400).json({
                error: true,
                message: 'Invalid parameters.'
            });
        }

        const stakePoolDetails = await StakePools.getStakePoolsByPoolId(bech32PoolId);
        if (!stakePoolDetails) {
            return res.status(404).json({
                error: true,
                message: 'No ticker found for Pool ID.'
            });
        }

        const handle = stakePoolDetails.ticker.toLocaleLowerCase();

        const response = await ReservedHandles.checkAvailability(handle);
        if (response.available === false && response.type !== 'spo') {
            return res.status(400).json({
                error: true,
                message: 'Handle is unavailable.'
            });
        }

        // TODO!!!!
        // Before we run the challenge, we need to make sure the pool ID matches the vrf key.

        // Instructions:
        // VS validates that the vrf hash in the pool's registration certificate on the blockchain matches the blake2b hash of the sent vkey. 
        // Note: The VS should use the latest registration certificate on the chain for 
        // matching as the VRF is a "hot" key and can be changed at any time by the pool operator. 
        // A single point-in-time verification is sufficient to properly identify the pool operator.

        const result = await runChallengeCommand<ChallengeResult>();

        await PoolProofs.addPoolProof({ poolId: bech32PoolId, vrfKey: cborHexEncodedVRFKey, vKeyHash: hexEncodedVKeyHash, nonce: result.nonce });

        Logger.log(getLogMessage(startTime));

        const body: SpoChallengeResponseBody = {
            error: false,
            message: `Challenge ${result ? 'successful' : 'failed'}`,
            handle,
            challengeResult: result
        }

        return res.status(200).json(body);
    } catch (error) {
        Logger.log({ message: JSON.stringify(error), category: LogCategory.ERROR });
        return res.status(500).json({
            error: true,
            message: "An error occurred.",
        });
    }
};
