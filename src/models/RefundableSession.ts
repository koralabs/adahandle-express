import { BaseModel } from "./BaseModel";

export class RefundableSession extends BaseModel {
    public paymentAddress: string;
    public amount: number;
    public handle: string;
    public status?: 'pending' | 'submitted' | 'confirmed';
    public id?: string;

    constructor({ paymentAddress, amount, handle, id, status }: { paymentAddress: string, amount: number, handle: string, id?: string, status?: 'pending' | 'submitted' | 'confirmed' }) {
        super();
        this.paymentAddress = paymentAddress;
        this.amount = amount;
        this.handle = handle;
        this.status = status;
        this.id = id;
    }
}
