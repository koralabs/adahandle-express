import { uuid } from "../helpers/utils";
import { NewAddress } from "../helpers/wallet/cardano";
import { BaseModel } from "./BaseModel";

export type PaidSessionStatusType = "pending" | "submitted" | "confirmed";

interface PaidSessionType {
  phoneNumber: string;
  cost: number;
  handle: string;
  wallet: NewAddress;
  start: number;
  id?: string;
  txId?: string;
  status?: PaidSessionStatusType;
  attempts?: number;
}

export class PaidSession extends BaseModel {
  public phoneNumber: string;
  public cost: number;
  public handle: string;
  public wallet: NewAddress;
  public start: number;
  public attempts: number;
  public id?: string;
  public txId?: string;
  public status?: PaidSessionStatusType;

  constructor({
    id,
    phoneNumber,
    cost,
    handle,
    wallet,
    start,
    txId,
    status = 'pending',
    attempts = 0
  }: PaidSessionType) {
    super();
    this.id = id;
    this.phoneNumber = phoneNumber;
    this.cost = cost;
    this.handle = handle;
    this.wallet = wallet;
    this.start = start;
    this.txId = txId;
    this.status = status;
    this.attempts = attempts;
  }
}
