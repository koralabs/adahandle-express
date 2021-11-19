import { NewAddress } from "../helpers/wallet/cardano";
import { BaseModel } from "./BaseModel";

export type PaidSessionStatusType = "pending" | "processing" | "submitted" | "confirmed" | "expired";

interface PaidSessionType {
  emailAddress: string;
  cost: number;
  handle: string;
  wallet: NewAddress;
  start: number;
  id?: string;
  txId?: string;
  status?: PaidSessionStatusType;
  attempts?: number;
  dateAdded?: number;
}

export class PaidSession extends BaseModel {
  public emailAddress: string;
  public cost: number;
  public handle: string;
  public wallet: NewAddress;
  public start: number;
  public attempts: number;
  public id?: string;
  public txId?: string;
  public status?: PaidSessionStatusType;
  public dateAdded?: number;

  constructor({
    id,
    emailAddress,
    cost,
    handle,
    wallet,
    start,
    txId,
    status = 'pending',
    attempts = 0,
    dateAdded = Date.now()
  }: PaidSessionType) {
    super();
    this.id = id;
    this.emailAddress = emailAddress;
    this.cost = cost;
    this.handle = handle;
    this.wallet = wallet;
    this.start = start;
    this.txId = txId;
    this.status = status;
    this.attempts = attempts;
    this.dateAdded = dateAdded;
  }
}
