import * as admin from "firebase-admin";
import { ActiveSession } from "../models/ActiveSession";
import { AccessQueues } from "../models/firestore/collections/AccessQueues";
import { PaidSessions } from "../models/firestore/collections/PaidSessions";
import { RefundableSessions } from "../models/firestore/collections/RefundableSessions";
import { PaidSession } from "../models/PaidSession";
import { RefundableSession } from "../models/RefundableSession";
import { getS3 } from "./aws";
import { getChainLoad } from "./cardano";
import { lookupReturnAddresses } from "./graphql";
import { NewAddress } from "./wallet/cardano";

export interface AccessEntry {
  phone: string;
  sid?: string;
  status?: 'pending' | 'complete';
  start?: number;
}

interface AppendAccessResponse {
  updated: boolean;
  alreadyExists: boolean;
  position: number;
  chainLoad: number | null;
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

    return admin.initializeApp({
      credential: admin.credential.cert(credentials),
      databaseURL: 'https://ada-handle-reserve-default-rtdb.firebaseio.com/'
    });
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

export const removeAccessQueueData = async (phone: string): Promise<boolean> => {
  const updated: boolean = await AccessQueues.removeAccessQueueByPhone(phone);
  return updated;
}

export const appendAccessQueueData = async (phone: string): Promise<AppendAccessResponse> => {
  const { updated, alreadyExists, position } = await AccessQueues.addToQueueAndGetPosition(phone);

  const chainLoad = await getChainLoad();

  const response = {
    updated,
    alreadyExists,
    position,
    chainLoad
  };

  return response;
}
