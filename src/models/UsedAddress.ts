import { CreatedBySystem } from '../helpers/constants';
import { BaseModel } from './BaseModel';

export enum UsedAddressStatus {
    PENDING = 'pending',
    PROCESSED = 'processed',
    BAD_STATE = "bad_state",
    PROCESSING = "processing"
}

interface UsedAddressInputs {
    id: string;
    dateAdded?: number;
    txId?: string;
    createdBySystem?: CreatedBySystem;
}

export class UsedAddress extends BaseModel {
    public id: string;
    public dateAdded: number;
    public status: UsedAddressStatus;
    public txId: string;
    public createdBySystem: CreatedBySystem;

    constructor({ id, dateAdded = Date.now(), txId = '', createdBySystem = CreatedBySystem.UI }: UsedAddressInputs) {
        super();
        this.id = id;
        this.status = UsedAddressStatus.PENDING;
        this.dateAdded = dateAdded;
        this.txId = txId;
        this.createdBySystem = createdBySystem;
    }
}