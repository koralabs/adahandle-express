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

const getLogMessage = (startTime: number) => ({ message: `verify processed in ${Date.now() - startTime}ms`, event: 'verify.run', milliseconds: Date.now() - startTime, category: LogCategory.METRIC });

export const verifyHandler = async (req: express.Request, res: express.Response) => {
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

        const { poolId, signature } = req.body;

        const proof = await PoolProofs.getPoolProofById(poolId);

        if (!proof) {
            return res.status(404).json({
                error: true,
                message: 'Proof not found'
            });
        }

        if (!signature) {
            return res.status(400).json({
                error: true,
                message: 'Signature required'
            });
        }

        // verify incoming parameters
        if (!verifyIsAlphaNumeric(signature)) {
            return res.status(400).json({
                error: true,
                message: 'Invalid signature'
            });
        }

        // Verify the proof is not greater than 5 minutes old
        if ((Date.now() - proof.start) > 1000 * 60 * 5) {
            return res.status(400).json({
                error: true,
                message: 'Unable to verify. Not submitted within 5 minute tme window'
            });
        }

        const { vKeyHash, nonce } = proof;

        // save the proof to a local file to use with CLI
        const vKeyContents = `{"type": "VrfVerificationKey_PraosVRF", "description": "VRF Verification Key", "cborHex": "${proof.vrfKey}"}`;
        const vkeyLocation = resolve(__dirname, `../../../../bin/vrf-proof/${proof.poolId}-pool.vrf.vkey`);
        writeFileSync(vkeyLocation, vKeyContents);

        // execute CLI command
        const result = await runVerifyCommand<{ status: string } | { error: string }>({ vkeyLocation, vKeyHash, nonce, signature });

        const isVerified = result['status'] === 'ok' ?? false;

        await PoolProofs.updatePoolProof({ poolId: proof.poolId, signature });

        Logger.log(getLogMessage(startTime));

        // return true or false based on the result
        return res.status(200).json({
            error: !isVerified,
            message: isVerified ? 'Verified' : 'Not verified'
        });
    } catch (error) {
        Logger.log({ message: JSON.stringify(error), category: LogCategory.ERROR });
        return res.status(500).json({
            error: true,
            message: "An error occurred.",
        });
    }
};
