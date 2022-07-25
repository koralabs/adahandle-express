import { BaseModel } from './BaseModel';
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
    EXPIRED = 'expired'
}

export interface ActiveSessionInput {
    emailAddress: string;
    cost: number;
    refundAmount?: number;
    handle: string;
    paymentAddress: string;
    returnAddress?: string;
    txHash?: string;
    index?: number;
    start: number;
    id?: string;
    txId?: string;
    createdBySystem: CreatedBySystem;
    status?: Status;
    workflowStatus?: WorkflowStatus;
    attempts?: number;
    dateAdded?: number;
    walletId?: string;
    ipfsHash?: string;
    eternlFeeAddress?: string;
    eternlFee?: number;
}

export class ActiveSession extends BaseModel {
    public emailAddress: string;
    public cost: number;
    public refundAmount?: number;
    public handle: string;
    public paymentAddress: string;
    public returnAddress?: string;
    public txHash?: string;
    public index?: number;
    public start: number;
    public id?: string;
    public txId?: string;
    public createdBySystem: CreatedBySystem;
    public status?: Status;
    public workflowStatus?: WorkflowStatus;
    public attempts?: number;
    public dateAdded?: number;
    public walletId?: string;
    public ipfsHash?: string;
    public eternlFeeAddress?: string;
    public eternlFee?: number;

    constructor({
        id,
        walletId,
        emailAddress,
        cost,
        refundAmount,
        handle,
        paymentAddress,
        start,
        txId,
        createdBySystem,
        returnAddress,
        txHash,
        index,
        workflowStatus,
        status = Status.PENDING,
        attempts = 0,
        dateAdded = Date.now(),
        ipfsHash,
        eternlFeeAddress,
        eternlFee
    }: ActiveSessionInput) {
        super();
        this.id = id;
        this.walletId = walletId;
        this.emailAddress = emailAddress;
        this.cost = cost;
        this.refundAmount = refundAmount;
        this.handle = handle;
        this.paymentAddress = paymentAddress;
        this.returnAddress = returnAddress;
        this.txHash = txHash;
        this.index = index;
        this.start = start;
        this.txId = txId;
        this.createdBySystem = createdBySystem;
        this.status = status;
        this.workflowStatus = workflowStatus;
        this.attempts = attempts;
        this.dateAdded = dateAdded;
        this.ipfsHash = ipfsHash;
        this.eternlFeeAddress = eternlFeeAddress;
        this.eternlFee = eternlFee;
    }
}
