import { BaseModel } from "./BaseModel";
import { CreatedBySystem } from '../helpers/constants';

export enum Status {
    REFUNDABLE = 'refundable',
    PAID = 'paid',
    PENDING = 'pending',
    DLQ = 'dlq'
}

export enum WorkflowStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    SUBMITTED = 'submitted',
    CONFIRMED = 'confirmed',
    EXPIRED = 'expired',
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
    status?: Status,
    workflowStatus?: WorkflowStatus,
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
    public status?: Status
    public workflowStatus?: WorkflowStatus;
    public attempts?: number;
    public dateAdded?: number;

    constructor({ id, emailAddress, cost, refundAmount, handle, paymentAddress, start, txId, createdBySystem, returnAddress, workflowStatus, status = Status.PENDING, attempts = 0, dateAdded = Date.now() }: ActiveSessionInput) {
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
        this.workflowStatus = workflowStatus;
        this.attempts = attempts;
        this.dateAdded = dateAdded;
    }
}
