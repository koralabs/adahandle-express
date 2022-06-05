import * as express from 'express';

import { HEADER_HANDLE } from '../../helpers/constants';
import { Logger, LogCategory } from '../../helpers/Logger';
import { fetchAsset } from '../../helpers/blockfrost';

interface LookupAssetMetadataResponse {
    data?: {
        name: string;
        image: string;
        core: {
            og: number;
            prefix: string;
            version: number;
            termsofuse: string;
            handleEncoding: string;
        };
        website: string;
        description: string;
        augmentations: any[];
    };
    error?: {
        message: string;
    };
}

export const lookupAssetMetadataHandler = async (req: express.Request, res: express.Response) => {
    const startTime = Date.now();
    const getLogMessage = (startTime: number) => ({
        message: `lookupAssetMetadataHandler processed in ${Date.now() - startTime}ms`,
        event: 'lookupAssetMetadataHandler.run',
        milliseconds: Date.now() - startTime,
        category: LogCategory.METRIC
    });
    const { headers } = req;
    const handle = headers[HEADER_HANDLE] as string | undefined;

    if (!handle) {
        return res.status(400).json({
            error: {
                message: 'Missing handle parameter.'
            }
        } as LookupAssetMetadataResponse);
    }

    try {
        const data = await fetchAsset(handle);

        Logger.log(getLogMessage(startTime));

        if (data.error) {
            const {
                error: { status_code, error }
            } = data;
            return res.status(status_code ?? 500).json({
                error: {
                    message: error
                }
            } as LookupAssetMetadataResponse);
        }

        if (!data.data) {
            return res.status(400).json({
                error: {
                    message: 'No data provided.'
                }
            } as LookupAssetMetadataResponse);
        }

        const result: LookupAssetMetadataResponse = {
            data: data.data.onchain_metadata
        };

        return res.status(200).json(result);
    } catch (e) {
        Logger.log({ category: LogCategory.ERROR, message: JSON.stringify(e), event: 'locationHandler.run' });
        return res.status(500).json({
            error: true,
            message: 'Error occurred while processing request.'
        });
    }
};
