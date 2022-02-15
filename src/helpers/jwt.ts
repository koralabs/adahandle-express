import { GetObjectOutput } from 'aws-sdk/clients/s3';
import * as jwt from "jsonwebtoken";
import { Secret } from 'jsonwebtoken';
import { getS3 } from "./aws";
import { LogCategory, Logger } from "../helpers/Logger";

export interface AccessJWTPayload extends jwt.JwtPayload {
  emailAddress: string;
  isSPO?: boolean;
}

export interface SessionJWTPayload extends jwt.JwtPayload {
  emailAddress: string;
  cost: number;
  handle: string;
  isSPO?: boolean;
}

export interface AllSessionsJWTPayload extends jwt.JwtPayload {
  sessions: { handle: string; dateAdded: number }[]
}

type SecretContext = 'access' | 'session'

let accessSecret: Secret;
let sessionSecret: Secret;

export const getKey = async (
  context: SecretContext = 'access',
  type: 'secret' | 'public' = 'secret'
): Promise<Secret | null> => {
  const s3 = getS3();

  if ('access' === context && accessSecret) {
    return accessSecret;
  }

  if ('session' === context && sessionSecret) {
    return sessionSecret;
  }

  let Key = process.env[`MY_AWS_TOKEN_KEY_${context.toUpperCase()}`];
  if ('public' === type) {
    Key += '.pub';
  }

  let res: GetObjectOutput;
  try {
    res = await s3
      .getObject({
        Bucket: process.env.MY_AWS_BUCKET || "",
        Key: Key || "",
      })
      .promise();
  } catch (e) {
    Logger.log({ message: JSON.stringify(e), category: LogCategory.ERROR });
    return null;
  }

  const secret = res?.Body
    ? res.Body.toString("utf-8") as Secret
    : null;

  if ('access' === context && secret) {
    accessSecret = secret;
  }

  if ('session' === context && secret) {
    sessionSecret = secret;
  }

  return secret;
}

