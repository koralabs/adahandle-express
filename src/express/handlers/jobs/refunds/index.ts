import * as express from "express";

import { LogCategory, Logger } from "../../../../helpers/Logger";
import { getMintWalletServer } from "../../../../helpers/wallet/cardano";
import { StateData } from "../../../../models/firestore/collections/StateData";
import { UsedAddresses } from "../../../../models/firestore/collections/UsedAddresses";
import { verifyRefund } from "./verifyRefund";
import { checkWalletBalance } from "./checkWalletBalance";
import { processRefunds, Refund } from "./processRefunds";

const buildLogMessage = (startTime: number, refundsCount: number) => ({ message: `refundsHandler processed ${refundsCount} refunds in ${Date.now() - startTime}ms`, event: 'refundsHandler.run', count: refundsCount, milliseconds: Date.now() - startTime, category: LogCategory.METRIC });

export const handleRefunds = async (req: express.Request, res: express.Response) => {
    const startTime = Date.now();
    const stateData = await StateData.getStateData();
    const refundAddresses = await UsedAddresses.getRefundableAddresses(stateData.usedAddressesLimit);

    if (refundAddresses.length === 0) {
        return res.status(200).json({
            error: false,
            message: 'No refundable addresses found.'
        });
    }

    try {
        const verifiedRefunds = await refundAddresses.reduce<Promise<Refund[]>>(async (acc, address) => {
            const verifiedRefund = await acc;
            const refund = await verifyRefund(address.id);
            if (refund) {
                verifiedRefund.push(refund);
            }
            return verifiedRefund;
        }, Promise.resolve([]));

        if (verifiedRefunds.length === 0) {
            await StateData.unlockCron(CronJobLockName.REFUNDS_LOCK);

            return res.status(200).json({
                error: false,
                message: 'No verified refunds found.'
            });
        }

        const refundWallet = await getMintWalletServer();

        await checkWalletBalance(verifiedRefunds, refundWallet);

        await processRefunds(verifiedRefunds, refundWallet)

        Logger.log(buildLogMessage(startTime, verifiedRefunds.length));

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


export const refundsHandler = async (req: express.Request, res: express.Response) => {
    if (!await StateData.checkAndLockCron('refundsLock')){
      return res.status(200).json({
        error: false,
        message: 'Refunds cron is locked. Try again later.'
      });
    }
    const result = await handleRefunds(req, res);
    await StateData.unlockCron('refundsLock');
  }