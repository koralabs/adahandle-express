import { BaseModel } from "./BaseModel";
import { CreatedBySystem }  from '../helpers/constants';

export class RefundableSession extends BaseModel {
    public paymentAddress: string;
    public returnAddress: string;
    public amount: number;
    public handle: string;
    public status?: 'pending' | 'submitted' | 'confirmed';
    public id?: string;
    public createdBySystem: CreatedBySystem;

    constructor({ paymentAddress, returnAddress, amount, handle, id, status, createdBySystem }: { paymentAddress: string, returnAddress: string, amount: number, handle: string, id?: string, status?: 'pending' | 'submitted' | 'confirmed', createdBySystem: CreatedBySystem}) {
        super();
        this.paymentAddress = paymentAddress;
        this.returnAddress = returnAddress;
        this.amount = amount;
        this.handle = handle;
        this.status = status;
        this.id = id;
        this.createdBySystem = createdBySystem;
    }
}
