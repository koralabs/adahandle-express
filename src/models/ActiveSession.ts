import { NewAddress } from "../helpers/wallet/cardano";
import { BaseModel } from "./BaseModel";

export interface ActiveSessionInput {

    emailAddress: string,
    cost: number,
    handle: string,
    wallet: NewAddress,
    start: number,
    id?: string,
    txId?: string
}

export class ActiveSession extends BaseModel {
    public emailAddress: string;
    public cost: number;
    public handle: string;
    public wallet: NewAddress;
    public start: number;
    public id?: string;
    public txId?: string;

    constructor({ id, emailAddress, cost, handle, wallet, start, txId }: ActiveSessionInput) {
        super();
        this.id = id;
        this.emailAddress = emailAddress;
        this.cost = cost;
        this.handle = handle;
        this.wallet = wallet;
        this.start = start;
        this.txId = txId;
    }
}
