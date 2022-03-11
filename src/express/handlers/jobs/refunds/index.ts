import * as express from "express";

import { LogCategory, Logger } from "../../../../helpers/Logger";
import { getMintWalletServer } from "../../../../helpers/wallet/cardano";
import { StateData } from "../../../../models/firestore/collections/StateData";
import { SettingsRepo } from "../../../../models/firestore/collections/SettingsRepo";
import { UsedAddresses, UsedAddressUpdates } from "../../../../models/firestore/collections/UsedAddresses";
import { verifyRefund } from "./verifyRefund";
import { checkWalletBalance } from "./checkWalletBalance";
import { processRefunds, Refund } from "./processRefunds";
import { getMintingWalletId } from "../../../../helpers/constants";

const buildLogMessage = (startTime: number, refundsCount: number) => ({ message: `refundsHandler processed ${refundsCount} refunds in ${Date.now() - startTime}ms`, event: 'refundsHandler.run', count: refundsCount, milliseconds: Date.now() - startTime, category: LogCategory.METRIC });

export const handleRefunds = async (req: express.Request, res: express.Response) => {
    const startTime = Date.now();
    const settings = await SettingsRepo.getSettings();
    const refundAddresses = await UsedAddresses.getRefundableAddresses(settings.usedAddressesLimit);

    if (refundAddresses.length === 0) {
        return res.status(200).json({
            error: false,
            message: 'No refundable addresses found.'
        });
    }

    try {
        const { verifiedRefunds, usedAddressUpdates } = await refundAddresses.reduce<Promise<{ verifiedRefunds: Refund[], usedAddressUpdates: UsedAddressUpdates[] }>>(async (acc, address) => {
            const verifiedRefund = await acc;
            const { verifiedRefunds, usedAddressUpdates } = verifiedRefund;
            const result = await verifyRefund(address.id);
            if (result) {
                const { refund, status } = result;
                if (refund) {
                    verifiedRefunds.push(refund);
                } else if (status) {
                    usedAddressUpdates.push({ address: address.id, props: { status } });
                }
            }
            return verifiedRefund;
        }, Promise.resolve({ verifiedRefunds: [], usedAddressUpdates: [] }));

        if (usedAddressUpdates.length > 0) {
            await UsedAddresses.batchUpdateUsedAddresses(usedAddressUpdates);
        }

        if (verifiedRefunds.length === 0) {
            return res.status(200).json({
                error: false,
                message: 'No verified refunds found.'
            });
        }

        const walletId = getMintingWalletId();
        const refundWallet = await getMintWalletServer(walletId);

        await checkWalletBalance(verifiedRefunds, refundWallet);

        await processRefunds(verifiedRefunds)

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
    if (!await StateData.checkAndLockCron('refundsLock')) {
        return res.status(200).json({
            error: false,
            message: 'Refunds cron is locked. Try again later.'
        });
    }
    await handleRefunds(req, res);
    await StateData.unlockCron('refundsLock');
}