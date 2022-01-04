import { BaseModel } from "./BaseModel";

export interface ActiveSessionInput {

    emailAddress: string,
    cost: number,
    handle: string,
    paymentAddress: string,
    start: number,
    id?: string,
    txId?: string
}

export class ActiveSession extends BaseModel {
    public emailAddress: string;
    public cost: number;
    public handle: string;
    public paymentAddress: string;
    public start: number;
    public id?: string;
    public txId?: string;

    constructor({ id, emailAddress, cost, handle, paymentAddress, start, txId }: ActiveSessionInput) {
        super();
        this.id = id;
        this.emailAddress = emailAddress;
        this.cost = cost;
        this.handle = handle;
        this.paymentAddress = paymentAddress;
        this.start = start;
        this.txId = txId;
    }
}
