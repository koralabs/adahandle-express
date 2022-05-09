import * as express from "express";
import * as jwt from "jsonwebtoken";
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { HEADER_JWT_SPO_ACCESS_TOKEN } from "../../../helpers/constants";

import { runVerifyCommand } from "../../../helpers/executeChildProcess";
import { getKey } from "../../../helpers/jwt";
import { LogCategory, Logger } from "../../../helpers/Logger";
import { verifyIsAlphaNumeric } from "../../../helpers/utils";
import { PoolProofs } from "../../../models/firestore/collections/PoolProofs";
import { StakePools } from "../../../models/firestore/collections/StakePools";
import { ReservedHandles } from "../../../models/firestore/collections/ReservedHandles";
import { createSpoSession } from "./createSpoSession";

interface SpoVerifyResponseBody {
    error: boolean;
    message: string;
    handle?: string;
    cost?: number;
    address?: string;
}

const getLogMessage = (startTime: number) => ({ message: `verify processed in ${Date.now() - startTime}ms`, event: 'verify.run', milliseconds: Date.now() - startTime, category: LogCategory.METRIC });

const verifySPO = async (accessToken: string, signature: string, poolId: string): Promise<{ code: number; body: SpoVerifyResponseBody }> => {
    try {
        const startTime = Date.now();

        if (!accessToken) {
            return {
                code: 400,
                body: {
                    error: true,
                    message: 'Must provide a valid access and id token.'
                }
            }
        }

        const accessSecret = await getKey('access');
        if (!accessSecret) {
            return {
                code: 500,
                body: {
                    error: true,
                    message: 'Something went wrong with access secrets.'
                }
            }
        }

        const validAccessToken = jwt.verify(accessToken as string, accessSecret);
        if (!validAccessToken) {
            return {
                code: 403,
                body: {
                    error: true,
                    message: 'Provided access token was invalid or expired.'
                }
            };
        }

        const proof = await PoolProofs.getPoolProofById(poolId);

        if (!proof) {
            return {
                code: 404,
                body: {
                    error: true,
                    message: 'Proof not found.'
                }
            };
        }

        if (!signature) {
            return {
                code: 400,
                body: {
                    error: true,
                    message: 'Signature required.'
                }
            };
        }

        // verify incoming parameters
        if (!verifyIsAlphaNumeric(signature)) {
            return {
                code: 400,
                body: {
                    error: true,
                    message: 'Invalid signature.'
                }
            }
        }

        // Verify the proof is not greater than 5 minutes old
        if ((Date.now() - proof.start) > 1000 * 60 * 5) {
            return {
                code: 400,
                body: {
                    error: true,
                    message: 'Verification timeout.'
                }
            };
        }

        // get handle data from stake pool
        const stakePoolDetails = await StakePools.getStakePoolsByPoolId(poolId);
        if (!stakePoolDetails) {
            return {
                code: 404,
                body: {
                    error: true,
                    message: 'No ticker found for Pool ID.'
                }
            };
        }

        const handle = stakePoolDetails.ticker.toLocaleLowerCase();

        // cost can either be 2 or 250 ADA
        const cost = stakePoolDetails.isOG ? 2 : 250;

        // verify exists
        const response = await ReservedHandles.checkAvailability(handle);
        if (response.available === false && response.type !== 'spo') {
            return {
                code: 400,
                body: {
                    error: true,
                    message: 'Handle is unavailable.'
                }
            };
        }

        const notVerifiedResponse = {
            code: 400,
            body: {
                error: true,
                message: 'Not verified.'
            }
        }

        let isVerified = false;

        try {
            const { vKeyHash, nonce } = proof;

            // save the proof to a local file to use with CLI
            const vKeyContents = `{"type": "VrfVerificationKey_PraosVRF", "description": "VRF Verification Key", "cborHex": "${proof.vrfKey}"}`;
            const outputPath = '../../../../bin';
            const vkeyLocation = resolve(__dirname, `${outputPath}/${proof.poolId}-pool.vrf.vkey`);
            writeFileSync(vkeyLocation, vKeyContents);

            const result = await runVerifyCommand<{ status: string } | { error: string }>({ vkeyLocation, vKeyHash, nonce, signature });

            isVerified = result['status'] === 'ok' ?? false;
        } catch (error) {
            const errorString = JSON.stringify(error);

            if (errorString.includes('InvalidHexCharacter')) return notVerifiedResponse;

            Logger.log({ message: JSON.stringify(error), event: 'verifyHandler.runVerifyCommand', category: LogCategory.ERROR });
            return {
                code: 500,
                body: {
                    error: true,
                    message: "An error occurred.",
                }
            };
        }


        if (!isVerified) return notVerifiedResponse;

        await PoolProofs.updatePoolProof({ poolId: proof.poolId, signature });

        // create an active session with the pool details
        const createSessionResult = await createSpoSession(handle, cost);
        if (!createSessionResult) {
            return {
                code: 400,
                body: {
                    error: true,
                    message: 'Cannot register handle.',
                }
            }
        }

        Logger.log(getLogMessage(startTime));

        const responseBody: SpoVerifyResponseBody = {
            error: false,
            message: 'Verified',
            handle,
            cost,
            address: createSessionResult
        }

        return {
            code: 200,
            body: responseBody
        }
    } catch (error) {
        Logger.log({ message: JSON.stringify(error), event: 'verifyHandler.verifySPO', category: LogCategory.ERROR });
        return {
            code: 500,
            body: {
                error: true,
                message: "An error occurred.",
            }
        };
    }
}

export const verifyHandler = async (req: express.Request, res: express.Response) => {
    const accessToken = req.headers[HEADER_JWT_SPO_ACCESS_TOKEN];
    const { body: { signature, poolId } } = req;
    const result = await verifySPO(accessToken as string, signature, poolId);

    const { code, body } = result;
    return res.status(code).json(body);
};
