import * as admin from "firebase-admin";
import { AccessQueues } from "../models/firestore/collections/AccessQueues";
import { getS3 } from "./aws";
import { isTesting } from "./constants";

export interface AccessEntry {
  email: string;
  sid?: string;
  status?: 'pending' | 'complete';
  start?: number;
}

interface AppendAccessResponse {
  updated: boolean;
  alreadyExists: boolean;
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

    if (isTesting()) {
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
    console.log(e);
    return false;
  }
};

export const verifyTwitterUser = async (token: string): Promise<number | false> => {
  try {
    const { exp } = await admin.auth().verifyIdToken(token)
    return exp;
  } catch (e) {
    console.log(e);
    return false;
  }
}

export const getAccessQueueCount = async (): Promise<number> => {
  const count = await AccessQueues.getAccessQueues()
  return count.length ?? 0;
}

export const removeAccessQueueData = async (email: string): Promise<boolean> => {
  const updated: boolean = await AccessQueues.removeAccessQueueByEmail(email);
  return updated;
}

export const appendAccessQueueData = async (email: string): Promise<AppendAccessResponse> => {
  const { updated, alreadyExists } = await AccessQueues.addToQueue(email);

  const response = {
    updated,
    alreadyExists
  };

  return response;
}
