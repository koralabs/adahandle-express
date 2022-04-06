import * as express from "express";
import { writeFileSync } from 'fs';
import { resolve } from 'path';

import { buildVerifyCommend, executeChildProcess } from "../../../helpers/executeChildProcess";
import { LogCategory, Logger } from "../../../helpers/Logger";
import { PoolProofs } from "../../../models/firestore/collections/PoolProofs";

const getLogMessage = (startTime: number) => ({ message: `verify processed in ${Date.now() - startTime}ms`, event: 'verify.run', milliseconds: Date.now() - startTime, category: LogCategory.METRIC });

export const verify = async (req: express.Request, res: express.Response) => {
    try {
        const { poolId, signature } = req.body;

        const startTime = Date.now();

        const proof = await PoolProofs.getPoolProofById(poolId);

        if (!proof) {
            return res.status(404).json({
                error: false,
                message: 'Proof not found'
            });
        }

        if (!signature) {
            return res.status(400).json({
                error: false,
                message: 'Signature required'
            });
        }

        // Verify the proof is not greater than 5 minutes old
        if ((Date.now() - proof.start) > 1000 * 60 * 5) {
            return res.status(400).json({
                error: false,
                message: 'Unable to verify. Not submitted within 5 minute tme window'
            });
        }

        const { vKeyHash, nonce } = proof;

        // save the proof to a local file to use with CLI
        const vKeyContents = `{"type": "VrfVerificationKey_PraosVRF", "description": "VRF Verification Key", "cborHex": "${proof.vrfKey}"}`;
        const vkeyLocation = resolve(__dirname, `${poolId}-pool.vrf.vkey`); // ../../../../bin/vrf-proof/
        writeFileSync(vkeyLocation, vKeyContents);

        // create CLI command
        const verifyCommand = buildVerifyCommend({ vkeyLocation, vKeyHash, nonce, signature })

        // execute CLI command
        const result = await executeChildProcess<{ status: string } | { error: string }>(verifyCommand);

        const isVerified = result['status'] === 'ok' ?? false;

        await PoolProofs.updatePoolProof({ poolId, signature });

        Logger.log(getLogMessage(startTime));

        // return true or false based on the result
        return res.status(200).json({
            error: !isVerified,
        });
    } catch (error) {
        Logger.log({ message: JSON.stringify(error), category: LogCategory.ERROR });
        return res.status(500).json({
            error: true,
            message: "An error occurred.",
        });
    }
};
