import { NewAddress } from "../helpers/wallet/cardano";
import { BaseModel } from "./BaseModel";

type PaidSessionStatusType = "pending" | "submitted" | "confirmed";

interface PaidSessionType {
  phoneNumber: string;
  cost: number;
  handle: string;
  wallet: NewAddress;
  start: number;
  txId?: string;
  status?: PaidSessionStatusType;
}

export class PaidSession extends BaseModel {
  public phoneNumber: string;
  public cost: number;
  public handle: string;
  public wallet: NewAddress;
  public start: number;
  public txId?: string;
  public status?: PaidSessionStatusType;

  constructor({
    phoneNumber,
    cost,
    handle,
    wallet,
    start,
    txId,
    status = 'pending'
  }: PaidSessionType) {
    super();
    this.phoneNumber = phoneNumber;
    this.cost = cost;
    this.handle = handle;
    this.wallet = wallet;
    this.start = start;
    this.txId = txId;
    this.status = status;
  }
}
