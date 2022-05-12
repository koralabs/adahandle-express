import * as express from "express";
import * as cardanoAddresses from 'cardano-addresses';

import { HEADER_HANDLE } from "../../helpers/constants";
import { Logger, LogCategory } from '../../helpers/Logger';
import { fetchAssetsAddresses } from "../../helpers/blockfrost";

interface lookupAddressResponseBody {
    error: boolean;
    message?: string;
    assetName?: string;
    isShellyAddress?: boolean;
    address?: string;
    addressType?: number;
}

export const isValidShellyAddress = (addressType: number): boolean => addressType < 8 && addressType % 2 === 0;

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

    try {
        const assetName = Buffer.from(handle).toString('hex');
        const data = await fetchAssetsAddresses(handle);

        // If there is no address, we received an error.
        if (!data.address) {
            if (data.statusCode === 404) {
                return res.status(404).json({
                    error: false,
                    assetName
                });
            }

            return res.status(data.statusCode ?? 500).json({
                error: true,
                assetName
            });
        }

        const { address } = data;

        const addressDetails = await cardanoAddresses.inspectAddress(address);

        Logger.log(getLogMessage(startTime))

        return res.status(200).json({
            error: false,
            isShellyAddress: isValidShellyAddress(addressDetails.address_type),
            assetName,
            address,
            addressType: addressDetails.address_type
        });
    } catch (e) {
        Logger.log({ category: LogCategory.ERROR, message: JSON.stringify(e), event: 'locationHandler.run' })
        return res.status(500).json({
            error: true,
            message: 'Error occurred while processing request.'
        });
    }
}
