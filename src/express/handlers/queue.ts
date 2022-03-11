import * as express from "express";
import * as fs from 'fs';

import { HEADER_EMAIL, isLocal, isTesting } from "../../helpers/constants";
import { appendAccessQueueData } from "../../helpers/firebase";
import { LogCategory, Logger } from "../../helpers/Logger";
import { calculatePositionAndMinutesInQueue } from "../../helpers/utils";
import { StateData } from "../../models/firestore/collections/StateData";
import { SettingsRepo } from "../../models/firestore/collections/SettingsRepo";
import { createConfirmationEmail } from "../../helpers/email"

interface VerifyClientAgentInfoResult {
  sha?: string,
  errorCode?: string;
}

interface QueueResponseBody {
  error: boolean;
  updated?: boolean;
  alreadyExists?: boolean;
  accessQueuePosition?: {
    position: number;
    minutes: number;
  },
  accessQueueSize?: number;
  message?: string;
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
  const startTime = Date.now();
  const getLogMessage = (startTime: number) => ({ message: `postToQueueHandler processed in ${Date.now() - startTime}ms`, event: 'postToQueueHandler.run', milliseconds: Date.now() - startTime, category: LogCategory.METRIC });

  const forbiddenSuspiciousResponse = (code: string) => ({
    error: true,
    message: `Forbidden: Suspicious Activity. Send this code to support@adahandle.com for assistance: ${code}`
  });

  if (!req.body.clientAgent || !req.body.clientIp) {
    return res.status(403).json(forbiddenSuspiciousResponse('missing_agent_info'));
  }

  const { clientAgent, clientIp } = req.body;

  const fileName = `${process.cwd()}/dist/helpers/clientAgentInfo/index.js`;
  let clientAgentSha = 'unknown';

  if (fs.existsSync(fileName)) {
    const { verifyClientAgentInfo } = await import(fileName);
    const verifiedInfo = await verifyClientAgentInfo(clientAgent, clientIp) as VerifyClientAgentInfoResult;
    if (verifiedInfo.errorCode || !verifiedInfo.sha) {
      return res.status(403).json(forbiddenSuspiciousResponse(verifiedInfo.errorCode || 'agent_info_failed'));
    }

    clientAgentSha = verifiedInfo.sha;
  } else if (!isLocal() && !isTesting()) {
    Logger.log({ message: 'Missing adahandle-client-agent-info', event: 'adahandleClientAgentInfo.notFound', category: LogCategory.NOTIFY });
    throw new Error('Missing adahandle-client-agent-info');
  }

  try {
    const email = req.headers[HEADER_EMAIL] as string;
    const validEmail = validateEmail(email);
    if (!validEmail) {
      return res.status(400).json({
        error: true,
        message: "Invalid email."
      } as QueueResponseBody);
    }

    const { updated, alreadyExists, dateAdded } = await appendAccessQueueData({ email, clientAgentSha, clientIp });
    const { accessQueueSize, lastAccessTimestamp } = await StateData.getStateData();
    const { accessQueueLimit } = await SettingsRepo.getSettings();
    const accessQueuePosition = calculatePositionAndMinutesInQueue(accessQueueSize, lastAccessTimestamp, dateAdded, accessQueueLimit);

    if (updated && accessQueuePosition.minutes > 10) {
      try {
        await createConfirmationEmail(email, accessQueuePosition.position, accessQueueSize, accessQueuePosition.minutes);
      }
      catch (e) {
        Logger.log({ message: JSON.stringify(e), event: 'postToQueueHandler.sendEmailConfirmation', category: LogCategory.ERROR });
      }
    }

    Logger.log(getLogMessage(startTime))
    return res.status(200).json({
      error: false,
      updated,
      alreadyExists,
      accessQueuePosition,
      accessQueueSize,
      message: alreadyExists
        ? `Whoops! Looks like you're already in line. You'll receive your access link via the email address you entered when it's your turn!`
        : null,
    } as QueueResponseBody);
  } catch (e) {
    Logger.log({ message: JSON.stringify(e), event: 'postToQueueHandler.appendAccessQueueData', category: LogCategory.ERROR });
    return res.status(404).json({
      error: true,
      message: JSON.stringify(e),
    } as QueueResponseBody);
  }
}
