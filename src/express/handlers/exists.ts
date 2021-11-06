import * as express from "express";

import { HEADER_HANDLE } from "../../helpers/constants";
import { handleExists, GraphqlHandleExistsResponse } from '../../helpers/graphql';

interface ExistsResponseBody {
  error: boolean;
  message?: string;
  exists?: boolean;
}

export const handleExistsHandler = async (req: express.Request, res: express.Response) => {
  if (!req.headers[HEADER_HANDLE]) {
    return res.status(400).json({
      error: true,
      message: "Missing handle name."
    } as ExistsResponseBody);
  }

  try {
    const exists: GraphqlHandleExistsResponse = await handleExists(req.headers[HEADER_HANDLE] as string);
    return res.status(200).json({
      error: false,
      ...exists
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({
      error: true,
      message: JSON.stringify(e)
    })
  }
}
