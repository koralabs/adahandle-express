import { BaseModel } from "./BaseModel";

interface AccessQueueInput {
    phone: string;
    sid?: string;
    status?: string;
    start?: number;
}

export class AccessQueue extends BaseModel {
    public phone: string;
    public dateAdded: number = Date.now();
    public sid?: string;
    public status?: string;
    public start?: number;

    constructor({ phone, sid, status, start }: AccessQueueInput) {
        super();
        this.phone = phone;
        this.sid = sid;
        this.status = status;
        this.start = start;
        this.dateAdded = Date.now();
    }
}