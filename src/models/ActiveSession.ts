import { NewAddress } from "../helpers/wallet/cardano";
import { BaseModel } from "./BaseModel";

export interface ActiveSessionInput {

    phoneNumber: string,
    cost: number,
    handle: string,
    wallet: NewAddress,
    start: number,
    id?: string,
    txId?: string
}

export class ActiveSession extends BaseModel {
    public phoneNumber: string;
    public cost: number;
    public handle: string;
    public wallet: NewAddress;
    public start: number;
    public id?: string;
    public txId?: string;

    constructor({ id, phoneNumber, cost, handle, wallet, start, txId }: ActiveSessionInput) {
        super();
        this.id = id;
        this.phoneNumber = phoneNumber;
        this.cost = cost;
        this.handle = handle;
        this.wallet = wallet;
        this.start = start;
        this.txId = txId;
    }
}
