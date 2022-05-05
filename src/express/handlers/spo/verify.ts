import * as express from "express";
import * as jwt from "jsonwebtoken";
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { CreatedBySystem, HEADER_JWT_SPO_ACCESS_TOKEN } from "../../../helpers/constants";

import { runVerifyCommand } from "../../../helpers/executeChildProcess";
import { getKey } from "../../../helpers/jwt";
import { LogCategory, Logger } from "../../../helpers/Logger";
import { toLovelace, verifyIsAlphaNumeric } from "../../../helpers/utils";
import { PoolProofs } from "../../../models/firestore/collections/PoolProofs";
// import { StakePools } from "../../../models/firestore/collections/StakePools";
// import { ReservedHandles } from "../../../models/firestore/collections/ReservedHandles";
import { ActiveSession, Status } from "../../../models/ActiveSession";
import { getNewAddress } from "../../../helpers/wallet";
import { ActiveSessions } from "../../../models/firestore/collections/ActiveSession";
import { SettingsRepo } from "../../../models/firestore/collections/SettingsRepo";

interface SpoVerifyResponseBody {
    error: boolean;
    message: string;
    handle?: string;
    cost?: number;
    address?: string;
}

const getLogMessage = (startTime: number) => ({ message: `verify processed in ${Date.now() - startTime}ms`, event: 'verify.run', milliseconds: Date.now() - startTime, category: LogCategory.METRIC });

const verify = async (accessToken: string, signature: string, poolId: string): Promise<{ code: number; body: SpoVerifyResponseBody }> => {
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
                    message: 'Proof not found'
                }
            };
        }

        if (!signature) {
            return {
                code: 400,
                body: {
                    error: true,
                    message: 'Signature required'
                }
            };
        }

        // verify incoming parameters
        if (!verifyIsAlphaNumeric(signature)) {
            return {
                code: 400,
                body: {
                    error: true,
                    message: 'Invalid signature'
                }
            }
        }

        // Verify the proof is not greater than 5 minutes old
        if ((Date.now() - proof.start) > 1000 * 60 * 5) {
            return {
                code: 400,
                body: {
                    error: true,
                    message: 'Unable to verify. Not submitted within 5 minute tme window'
                }
            };
        }

        // get handle data from stake pool
        // const stakePoolDetails = await StakePools.getStakePoolsByPoolId(poolId);
        const stakePoolDetails = {
            ticker: 'TEST',
            isOG: false
        }
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
        // const response = await ReservedHandles.checkAvailability(handle);
        const response = { available: true, type: 'ticker' };
        if (response.available === false && response.type !== 'spo') {
            return {
                code: 400,
                body: {
                    error: true,
                    message: 'Handle already exists.'
                }
            };
        }


        const { vKeyHash, nonce } = proof;

        // save the proof to a local file to use with CLI
        const vKeyContents = `{"type": "VrfVerificationKey_PraosVRF", "description": "VRF Verification Key", "cborHex": "${proof.vrfKey}"}`;
        const vkeyLocation = resolve(__dirname, `../../../../bin/vrf-proof/${proof.poolId}-pool.vrf.vkey`);
        writeFileSync(vkeyLocation, vKeyContents);

        // execute CLI command
        const result = await runVerifyCommand<{ status: string } | { error: string }>({ vkeyLocation, vKeyHash, nonce, signature });

        const isVerified = result['status'] === 'ok' ?? false;

        if (!isVerified) {
            return {
                code: 200,
                body: {
                    error: true,
                    message: 'Not verified'
                }
            }
        }

        // create an active session with the pool details
        const newSession = new ActiveSession({
            emailAddress: 'spo@adahandle.com',
            handle,
            paymentAddress: '',
            cost: toLovelace(cost),
            start: Date.now(),
            createdBySystem: CreatedBySystem.UI,
            status: Status.PENDING
        });

        const settings = await SettingsRepo.getSettings();
        const walletAddress = await getNewAddress(newSession.createdBySystem, settings.walletAddressCollectionName);

        if (false === walletAddress) {
            return {
                code: 500,
                body: {
                    error: true,
                    message: 'Failed to retrieve payment address data.',
                }
            };
        }

        newSession.paymentAddress = walletAddress;
        const added = await ActiveSessions.addActiveSession(newSession);
        if (!added) {
            return {
                code: 400,
                body: {
                    error: true,
                    message: 'Sorry, this handle is being purchased! Try another handle.',
                }
            };
        }

        await PoolProofs.updatePoolProof({ poolId: proof.poolId, signature });

        Logger.log(getLogMessage(startTime));

        const responseBody: SpoVerifyResponseBody = {
            error: false,
            message: 'Verified',
            handle,
            cost,
            address: walletAddress
        }

        return {
            code: 200,
            body: responseBody
        }
    } catch (error) {
        Logger.log({ message: JSON.stringify(error), category: LogCategory.ERROR });
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
    const result = await verify(accessToken as string, signature, poolId);

    const { code, body } = result;
    return res.status(code).json(body);
};
