import { NewAddress } from "../helpers/wallet/cardano";
import { BaseModel } from "./BaseModel";

export class RefundableSession extends BaseModel {
    public wallet: NewAddress;
    public amount: number;
    public handle: string;

    constructor({ wallet, amount, handle }: { wallet: NewAddress, amount: number, handle: string }) {
        super();
        this.wallet = wallet;
        this.amount = amount;
        this.handle = handle;
    }
}
