import { BaseModel } from "./BaseModel";
import { CreatedBySystem }  from '../helpers/constants';

export type PaidSessionStatusType = "pending" | "processing" | "submitted" | "confirmed" | "expired";

interface PaidSessionType {
  emailAddress: string;
  cost: number;
  handle: string;
  start: number;
  paymentAddress: string;
  returnAddress: string;
  id?: string;
  txId?: string;
  status?: PaidSessionStatusType;
  attempts?: number;
  dateAdded?: number;
  createdBySystem: CreatedBySystem;
}

export class PaidSession extends BaseModel {
  public emailAddress: string;
  public cost: number;
  public handle: string;
  public start: number;
  public attempts: number;
  public paymentAddress: string;
  public returnAddress: string;
  public id?: string;
  public txId?: string;
  public status?: PaidSessionStatusType;
  public dateAdded?: number;
  public createdBySystem: CreatedBySystem;

  constructor({
    id,
    emailAddress,
    cost,
    handle,
    paymentAddress,
    returnAddress,
    start,
    txId,
    status = 'pending',
    attempts = 0,
    dateAdded = Date.now(),
    createdBySystem
    
  }: PaidSessionType) {
    super();
    this.id = id;
    this.emailAddress = emailAddress;
    this.cost = cost;
    this.handle = handle;
    this.paymentAddress = paymentAddress;
    this.returnAddress = returnAddress;
    this.start = start;
    this.txId = txId;
    this.status = status;
    this.attempts = attempts;
    this.dateAdded = dateAdded;
    this.createdBySystem = createdBySystem;
  }
}
