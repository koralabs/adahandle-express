import { BaseModel } from "./BaseModel";
import { CreatedBySystem } from '../helpers/constants';

export enum ActiveSessionStatus {
    REFUNDABLE_PENDING = 'refundable_pending',
    REFUNDABLE_SUBMITTED = 'refundable_submitted',
    REFUNDABLE_CONFIRMED = 'refundable_confirmed',
    PAID_PENDING = 'paid_pending',
    PAID_PROCESSING = 'paid_processing',
    PAID_SUBMITTED = 'paid_submitted',
    PAID_CONFIRMED = 'paid_confirmed',
    PAID_EXPIRED = 'paid_expired',
    PENDING = 'pending',
    DLQ = 'dlq'
}

export interface ActiveSessionInput {
    emailAddress: string,
    cost: number,
    refundAmount?: number,
    handle: string,
    paymentAddress: string,
    returnAddress?: string,
    start: number,
    id?: string,
    txId?: string,
    createdBySystem: CreatedBySystem,
    status?: ActiveSessionStatus
    attempts?: number;
    dateAdded?: number;
}

export class ActiveSession extends BaseModel {
    public emailAddress: string;
    public cost: number;
    public refundAmount?: number;
    public handle: string;
    public paymentAddress: string;
    public returnAddress?: string;
    public start: number;
    public id?: string;
    public txId?: string;
    public createdBySystem: CreatedBySystem
    public status?: ActiveSessionStatus
    public attempts?: number;
    public dateAdded?: number;

    constructor({ id, emailAddress, cost, refundAmount, handle, paymentAddress, start, txId, createdBySystem, returnAddress, status = ActiveSessionStatus.PENDING, attempts = 0, dateAdded = Date.now() }: ActiveSessionInput) {
        super();
        this.id = id;
        this.emailAddress = emailAddress;
        this.cost = cost;
        this.refundAmount = refundAmount;
        this.handle = handle;
        this.paymentAddress = paymentAddress;
        this.returnAddress = returnAddress;
        this.start = start;
        this.txId = txId;
        this.createdBySystem = createdBySystem;
        this.status = status;
        this.attempts = attempts;
        this.dateAdded = dateAdded;
    }
}
