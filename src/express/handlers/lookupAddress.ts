import * as express from "express";
import fetch from 'cross-fetch';
import * as cardanoAddresses from 'cardano-addresses';

import { getBlockfrostApiKey, getPolicyId, HEADER_HANDLE, isProduction } from "../../helpers/constants";
import { Logger, LogCategory } from '../../helpers/Logger';

interface lookupAddressResponseBody {
    error: boolean;
    message?: string;
    assetName?: string;
    isShellyAddress?: boolean;
    address?: string;
}

export const lookupAddressHandler = async (req: express.Request, res: express.Response) => {
    const startTime = Date.now();
    const getLogMessage = (startTime: number) => ({ message: `lookupAddressHandler processed in ${Date.now() - startTime}ms`, event: 'lookupAddressHandler.run', milliseconds: Date.now() - startTime, category: LogCategory.METRIC });
    const { headers } = req;
    const handle = headers[HEADER_HANDLE] as string | undefined;

    if (!handle) {
        return res.status(400).json({
            error: true,
            message: "Missing handle parameter."
        } as lookupAddressResponseBody);
    }

    const context = isProduction() ? 'mainnet' : 'testnet';
    const policyId = getPolicyId();
    const blockfrostApiKey = getBlockfrostApiKey();

    try {
        const assetName = Buffer.from(handle).toString('hex');
        const data = await fetch(
            `https://cardano-${context}.blockfrost.io/api/v0/assets/${policyId}${assetName}/addresses`,
            {
                headers: {
                    project_id: blockfrostApiKey,
                    'Content-Type': 'application/json'
                }
            }
        ).then(res => res.json());

        if (data?.status_code === 404) {
            return res.status(404).json({
                error: false,
                assetName
            });
        }

        const [result] = data;
        const addressDetails = await cardanoAddresses.inspectAddress(result.address);

        Logger.log(getLogMessage(startTime))

        return res.status(200).json({
            error: false,
            isShellyAddress: addressDetails.address_type === 0,
            assetName,
            address: result.address,
        });
    } catch (e) {
        Logger.log({ category: LogCategory.ERROR, message: JSON.stringify(e), event: 'locationHandler.run' })
        return res.status(500).json({
            error: true,
            message: 'Error occurred while processing request.'
        });
    }
}
