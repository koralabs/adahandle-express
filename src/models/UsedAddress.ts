import { BaseModel } from './BaseModel';

export enum UsedAddressStatus {
    PENDING = 'pending',
    PROCESSED = 'processed',
    BAD_STATE = "bad_state",
    PROCESSING = "processing"
}

export class UsedAddress extends BaseModel {
    public dateAdded: number;
    public status: UsedAddressStatus;
    public txId: string;

    constructor(public id: string, dateAdded = Date.now(), txId = '') {
        super();
        this.status = UsedAddressStatus.PENDING;
        this.dateAdded = dateAdded;
        this.txId = txId;
    }
}