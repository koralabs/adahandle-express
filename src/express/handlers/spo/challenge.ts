import * as express from 'express';
import * as jwt from 'jsonwebtoken';
import { LogCategory, Logger } from '../../../helpers/Logger';
import { runChallengeCommand } from '../../../helpers/executeChildProcess';
import { PoolProofs } from '../../../models/firestore/collections/PoolProofs';
import { verifyIsAlphaNumeric, verifyIsPoolId } from '../../../helpers/utils';
import { HEADER_JWT_SPO_ACCESS_TOKEN } from '../../../helpers/constants';
import { getKey } from '../../../helpers/jwt';
import { StakePools } from '../../../models/firestore/collections/StakePools';
import { ReservedHandles } from '../../../models/firestore/collections/ReservedHandles';

interface ChallengeResult {
    status: string;
    domain: string;
    nonce: string;
}

export interface SpoChallengeResponseBody {
    error: boolean;
    message: string;
    handle?: string;
    challengeResult?: ChallengeResult;
}

const getLogMessage = (startTime: number) => ({
    message: `challenge processed in ${Date.now() - startTime}ms`,
    event: 'challenge.run',
    milliseconds: Date.now() - startTime,
    category: LogCategory.METRIC
});

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
            });
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
        if (
            !verifyIsPoolId(bech32PoolId) ||
            !verifyIsAlphaNumeric(cborHexEncodedVRFKey) ||
            !verifyIsAlphaNumeric(hexEncodedVKeyHash)
        ) {
            return res.status(400).json({
                error: true,
                message: 'Invalid parameters.'
            });
        }

        const stakePoolDetails = await StakePools.getStakePoolByPoolId(bech32PoolId);
        if (!stakePoolDetails || stakePoolDetails.isRetired === true) {
            return res.status(404).json({
                error: true,
                message: 'No ticker found for Pool ID.'
            });
        }

        // verify that poolId matches the vrf key that's stored in the database
        if (stakePoolDetails.vrfKeyHash !== hexEncodedVKeyHash) {
            return res.status(400).json({
                error: true,
                message: 'Pool details do not match.'
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

        // check for duplicates and figure out
        const duplicatePools = await StakePools.getStakePoolsByTicker(stakePoolDetails.ticker);
        if (duplicatePools.length > 1) {
            // all records should have oldestTxIncludedAt but if it doesn't, throw it out.
            const validPools = duplicatePools
                .filter((pool) => pool.oldestTxIncludedAt && !pool.isRetired)
                .map((pool) => {
                    return {
                        id: pool.id,
                        oldestTxIncludedAt: pool.oldestTxIncludedAt as number
                    };
                });

            const errorMessage = 'Pool has duplicates. Please use the oldest VRF/Pool id record to mint Handle.';
            if (validPools.length === 0) {
                return res.status(400).json({
                    error: true,
                    message: errorMessage
                });
            }

            // sort all pools by oldest to newest
            validPools.sort((a, b) => a.oldestTxIncludedAt - b.oldestTxIncludedAt);
            const [oldestPool] = validPools;
            // if the oldest pool is not the one we're trying to register, return an error
            if (oldestPool.id !== bech32PoolId) {
                return res.status(400).json({
                    error: true,
                    message: errorMessage
                });
            }
        }

        const result = await runChallengeCommand<ChallengeResult>();

        await PoolProofs.addPoolProof({
            poolId: bech32PoolId,
            vrfKey: cborHexEncodedVRFKey,
            vKeyHash: hexEncodedVKeyHash,
            nonce: result.nonce
        });

        Logger.log(getLogMessage(startTime));

        const body: SpoChallengeResponseBody = {
            error: false,
            message: `Challenge ${result ? 'successful' : 'failed'}`,
            handle,
            challengeResult: result
        };

        return res.status(200).json(body);
    } catch (error) {
        Logger.log({ message: JSON.stringify(error), category: LogCategory.ERROR });
        return res.status(500).json({
            error: true,
            message: 'An error occurred.'
        });
    }
};
