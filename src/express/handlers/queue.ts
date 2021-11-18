import * as express from "express";

import { HEADER_PHONE } from "../../helpers/constants";
import { appendAccessQueueData } from "../../helpers/firebase";
import { getTwilioClient } from "../../helpers/twilo";
import { AccessQueues } from "../../models/firestore/collections/AccessQueues";

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

    const { updated, alreadyExists } = await appendAccessQueueData(phoneNumber);

    if (updated) {
      const total = await AccessQueues.getAccessQueuesCount();
      const quickResponse = 'ADA Handle: Confirmed! Your spot has been saved. We will alert you as soon as it\'s your turn!';
      const longResponse = 'ADA Handle: Confirmed! Your spot has been saved. We will alert within ~3 hours of sending your auth code.';
      await client.messages.create({
        messagingServiceSid: process.env.TWILIO_MESSAGING_SID as string,
        to: phoneNumber,
        body: total > 300 ? longResponse : quickResponse
      });
    }

    return res.status(200).json({
      error: false,
      updated,
      alreadyExists,
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
