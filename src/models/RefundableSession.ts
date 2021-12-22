import { NewAddress } from "../helpers/wallet/cardano";
import { BaseModel } from "./BaseModel";

export class RefundableSession extends BaseModel {
    public wallet: NewAddress;
    public amount: number;
    public handle: string;
    public status?: 'pending' | 'submitted' | 'confirmed';
    public id?: string;

    constructor({ wallet, amount, handle, id, status }: { wallet: NewAddress, amount: number, handle: string, id?: string, status?: 'pending' | 'submitted' | 'confirmed' }) {
        super();
        this.wallet = wallet;
        this.amount = amount;
        this.handle = handle;
        this.status = status;
        this.id = id;
    }
}
