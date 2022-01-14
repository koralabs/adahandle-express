import * as express from "express";

import { LogCategory, Logger } from "../../../../helpers/Logger";
import { getMintWalletServer } from "../../../../helpers/wallet/cardano";
import { awaitForEach } from "../../../../helpers/utils";
import { CronJobLockName, StateData } from "../../../../models/firestore/collections/StateData";
import { UsedAddresses } from "../../../../models/firestore/collections/UsedAddresses";
import { verifyRefund } from "./verifyRefund";
import { checkWalletBalance } from "./checkWalletBalance";
import { processRefund, Refund } from "./processRefund";

const buildLogMessage = (startTime: number, refundsCount: number) => ({ message: `refundsHandler processed ${refundsCount} refunds in ${Date.now() - startTime}ms`, event: 'refundsHandler.run', count: refundsCount, milliseconds: Date.now() - startTime, category: LogCategory.METRIC });

export const refundsHandler = async (req: express.Request, res: express.Response) => {
    const startTime = Date.now();

    const stateData = await StateData.getStateData();
    if (stateData[CronJobLockName.REFUNDS_LOCK]) {
        Logger.log({ message: `Cron job ${CronJobLockName.REFUNDS_LOCK} is locked`, event: 'refundsHandler.locked', category: LogCategory.NOTIFY });
        return res.status(200).json({
            error: false,
            message: 'Refunds cron is locked. Try again later.'
        });
    }

    const refundAddresses = await UsedAddresses.getRefundableAddresses();

    if (refundAddresses.length === 0) {
        return res.status(200).json({
            error: false,
            message: 'No refundable addresses found.'
        });
    }

    await StateData.lockCron(CronJobLockName.REFUNDS_LOCK);

    try {
        const verifiedRefunds = await refundAddresses.reduce<Promise<Refund[]>>(async (acc, address) => {
            const verifiedRefund = await acc;
            const refund = await verifyRefund(address.id);
            if (refund) {
                verifiedRefund.push(refund);
            }
            return verifiedRefund;
        }, Promise.resolve([]));

        const refundWallet = await getMintWalletServer();

        await checkWalletBalance(verifiedRefunds, refundWallet);
        await awaitForEach(verifiedRefunds, (refund) => processRefund(refund, refundWallet));

        Logger.log(buildLogMessage(startTime, verifiedRefunds.length));

        await StateData.unlockCron(CronJobLockName.REFUNDS_LOCK);

        return res.status(200).json({
            error: false,
            message: `Processed ${verifiedRefunds.length} refunds.`
        });
    } catch (error) {
        Logger.log({ message: `Error on refundsHandler: ${error}`, event: 'refundsHandler.error', category: LogCategory.NOTIFY });
        return res.status(500).json({
            error: true,
            message: 'There was an error'
        });
    }
}