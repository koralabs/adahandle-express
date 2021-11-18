import { BaseModel } from "./BaseModel";

interface AccessQueueInput {
    phone: string;
    attempts?: number;
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
    public attempts: number

    constructor({ phone, sid, start, status = 'queued', attempts = 0 }: AccessQueueInput) {
        super();
        this.phone = phone;
        this.sid = sid;
        this.start = start
        this.status = status;
        this.attempts = attempts;
        this.dateAdded = Date.now();
    }
}
