import * as express from "express";
import * as sgMail from "@sendgrid/mail";

import { HEADER_EMAIL } from "../../helpers/constants";
import { appendAccessQueueData } from "../../helpers/firebase";
import { getTwilioClient } from "../../helpers/twilo";
import { AccessQueues } from "../../models/firestore/collections/AccessQueues";
import { LogCategory, Logger } from "../../helpers/Logger";

interface QueueResponseBody {
  error: boolean;
  updated?: boolean;
  alreadyExists?: boolean;
  message?: string;
  queue?: number;
}

const validateEmail = (email: string): boolean => {
  const res = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return res.test(String(email).toLowerCase());
}

export const postToQueueHandler = async (req: express.Request, res: express.Response) => {
  if (!req.headers[HEADER_EMAIL]) {
    return res.status(400).json({
      error: true,
      message: "Missing email address."
    } as QueueResponseBody);
  }

  const email = req.headers[HEADER_EMAIL] as string;
  const validEmail = validateEmail(email);
  if (!validEmail) {
    return res.status(400).json({
      error: true,
      message: "Invalid email."
    } as QueueResponseBody);
  }

  try {
    const { updated, alreadyExists } = await appendAccessQueueData(email);
    sgMail.setApiKey(process.env.SENDGRID_API_KEY as string);

    if (updated) {
      const total = await AccessQueues.getAccessQueuesCount();
      const quickResponse = 'We have saved your place in line! When it\'s your turn, we will send you a special access code. Depending on your place in line, you should receive your access code anytime between now and around 3 hours. Make sure you turn on email notifications!';
      const longResponse = 'We have saved your place in line! When it\'s your turn, we will send you a special access code. Your current wait is longer than 3 hours, so we\'ll email you a reminder when it\'s close to your turn. Make sure you turn on email notifications!';
      await sgMail
        .send({
          to: email,
          from: 'hello@adahandle.com',
          templateId: 'd-79d22808fad74353b4ffc1083f1ea03c',
          dynamicTemplateData: {
            title: 'Your Spot Is Saved',
            message: total > 300 ? longResponse : quickResponse
          }
        })
        .catch((error) => {
          Logger.log({ message: JSON.stringify(error), event: 'postToQueueHandler.sendEmailConfirmation', category: LogCategory.INFO });
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
    Logger.log({ message: JSON.stringify(e), event: 'postToQueueHandler.appendAccessQueueData', category: LogCategory.INFO });
    return res.status(404).json({
      error: true,
      message: JSON.stringify(e),
    } as QueueResponseBody);
  }
}
