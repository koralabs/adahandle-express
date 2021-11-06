import * as express from "express";

import { HEADER_PHONE } from "../../helpers/constants";
import { appendAccessQueueData } from "../../helpers/firebase";
import { getTwilioClient } from "../../helpers/twilo";

interface QueueResponseBody {
  error: boolean;
  updated?: boolean;
  alreadyExists?: boolean;
  message?: string;
  queue?: number;
}

export const postToQueueHandler = async (req: express.Request, res: express.Response) => {
  if (!req.headers[HEADER_PHONE]) {
    return res.status(400).json({
      error: true,
      message: "Missing phone number."
    } as QueueResponseBody);
  }

  try {
    const client = await getTwilioClient();
    const { phoneNumber } = await client.lookups
      .phoneNumbers(req.headers[HEADER_PHONE] as string)
      .fetch();

    const { updated, alreadyExists, position, chainLoad } = await appendAccessQueueData(phoneNumber);
    return res.status(200).json({
      error: false,
      updated,
      alreadyExists,
      position,
      chainLoad,
      message: alreadyExists
        ? `You already did that!`
        : null,
    } as QueueResponseBody);
  } catch (e) {
    console.log(e);
    return res.status(404).json({
      error: true,
      message: "Invalid phone number.",
    } as QueueResponseBody);
  }
}
