import * as admin from "firebase-admin";
import { AccessQueues } from "../models/firestore/collections/AccessQueues";
import { getS3 } from "./aws";
import { isTesting, isEmulating } from "./constants";
import { LogCategory, Logger } from "../helpers/Logger";
import { AccessQueue } from "../models/AccessQueue";

export interface AccessEntry {
  email: string;
  authCode?: string;
  status?: 'pending' | 'complete';
  start?: number;
}

export interface AppendAccessQueueInput { email: string; clientAgentSha: string; clientIp: string }

interface AppendAccessResponse {
  updated: boolean;
  alreadyExists: boolean;
  dateAdded: number;
}
export class Firebase {
  public static async init() {
    const s3 = getS3();
    const res = await s3
      .getObject({
        Bucket: process.env.MY_AWS_BUCKET as string,
        Key: process.env.MY_AWS_FIREBASE_KEY as string,
      })
      .promise();

    const credentials: admin.ServiceAccount | null = res?.Body
      ? JSON.parse(res.Body.toString("utf-8"))
      : null;

    if (!credentials) {
      throw new Error("Firebase did not successfully initialize.");
    }

    const app = admin.initializeApp({
      credential: admin.credential.cert(credentials),
      databaseURL: 'https://ada-handle-reserve-default-rtdb.firebaseio.com/'
    });

    if (isTesting() && isEmulating()) {
      const db = admin.firestore();
      db.settings({
        host: "localhost:8080",
        ssl: false
      });
    }

    return app;
  }
}

export const verifyAppCheck = async (token: string): Promise<admin.appCheck.VerifyAppCheckTokenResponse | boolean> => {
  try {
    const res = await admin.appCheck().verifyToken(token);
    return res;
  } catch (e) {
    Logger.log({ message: JSON.stringify(e), category: LogCategory.ERROR });
    return false;
  }
};

export const verifyTwitterUser = async (token: string): Promise<number | false> => {
  try {
    const { exp } = await admin.auth().verifyIdToken(token)
    return exp;
  } catch (e) {
    Logger.log({ message: JSON.stringify(e), category: LogCategory.ERROR });
    return false;
  }
}

export const getAccessQueueCount = async (): Promise<number> => {
  const count = await AccessQueues.getAccessQueues()
  return count.length ?? 0;
}

export const getAccessQueueData = async (id: string): Promise<AccessQueue> => {
  const access = await AccessQueues.getAccessQueueData(id)
  return access;
}

export const removeAccessQueueData = async (email: string): Promise<boolean> => {
  const updated: boolean = await AccessQueues.removeAccessQueueByEmail(email);
  return updated;
}

export const appendAccessQueueData = async (input: AppendAccessQueueInput): Promise<AppendAccessResponse> => {
  return await AccessQueues.addToQueue(input);
}
