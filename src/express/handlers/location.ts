import * as express from "express";
import { HEADER_HANDLE } from "../../helpers/constants";
import { lookupLocation, LookupResponseBody } from '../../helpers/graphql';
import { Logger, LogCategory } from '../../helpers/Logger';

export const locationHandler = async (req: express.Request, res: express.Response) => {
  const startTime = Date.now();
  const getLogMessage = (startTime: number) => ({ message: `locationHandler processed in ${Date.now() - startTime}ms`, event: 'locationHandler.run', milliseconds: Date.now() - startTime, category: LogCategory.METRIC });
  const { headers } = req;
  const handle = headers[HEADER_HANDLE];

  if (!handle) {
    return res.status(400).json({
      error: true,
      message: "Missing handle query parameter."
    } as LookupResponseBody);
  }

  try {
    const assets = await lookupLocation(handle as string);

    if (!assets) {
      return res.status(200).json({
        error: false,
        address: null,
        policyId: null,
        assetName: null
      } as LookupResponseBody);
    }

    if (assets.length > 1) {
      return res.status(200).json({
        error: true,
        message: 'This is a double mint!',
        address: null,
        policyId: null,
        assetName: null
      } as LookupResponseBody);
    }

    const location = assets[0]?.tokenMints[0]?.transaction?.outputs[0]?.address;
    Logger.log(getLogMessage(startTime))
    if (location) {
      return res.status(200).json({
        error: false,
        address: assets[0].tokenMints[0].transaction.outputs[0].address,
        policyId: assets[0].policyId,
        assetName: assets[0].assetName
      } as LookupResponseBody);
    }
  } catch (e) {
    Logger.log({category: LogCategory.ERROR, message: JSON.stringify(e), event: 'locationHandler.run'})
    return res.status(500).json({
      error: true,
      message: e
    });
  }
}
