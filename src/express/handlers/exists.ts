import * as express from "express";

import { HEADER_HANDLE } from "../../helpers/constants";
import { handleExists, GraphqlHandleExistsResponse } from '../../helpers/graphql';
import { LogCategory, Logger } from "../../helpers/Logger";

interface ExistsResponseBody {
  error: boolean;
  message?: string;
  exists?: boolean;
}

export const handleExistsHandler = async (req: express.Request, res: express.Response) => {
  const startTime = Date.now();
  const getLogMessage = (startTime: number) => ({ message: `handleExistsHandler processed in ${Date.now() - startTime}ms`, event: 'handleExistsHandler.run', milliseconds: Date.now() - startTime, category: LogCategory.METRIC });
  if (!req.headers[HEADER_HANDLE]) {
    return res.status(400).json({
      error: true,
      message: "Missing handle name."
    } as ExistsResponseBody);
  }

  try {
    const exists: GraphqlHandleExistsResponse = await handleExists(req.headers[HEADER_HANDLE] as string);
    //Logger.log(getLogMessage(startTime))
    return res.status(200).json({
      error: false,
      ...exists
    });
  } catch (e) {
    Logger.log({ message: JSON.stringify(e), category: LogCategory.ERROR });
    return res.status(500).json({
      error: true,
      message: JSON.stringify(e)
    })
  }
}
