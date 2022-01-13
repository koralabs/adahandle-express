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

    constructor(public id: string, dateAdded = Date.now()) {
        super();
        this.status = UsedAddressStatus.PENDING;
        this.dateAdded = dateAdded;
    }
}