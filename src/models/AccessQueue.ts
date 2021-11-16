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

    constructor({ phone, sid, status, start, attempts }: AccessQueueInput) {
        super();
        this.phone = phone;
        this.sid = sid;
        this.status = status ?? 'queued'; //'pending';
        this.start = start //new Date().setMinutes(new Date().getMinutes() - 11);
        this.dateAdded = Date.now() // new Date().setMilliseconds(new Date().getMilliseconds() + Math.floor(Math.random() * 2000));
        this.attempts = attempts ?? 0;
    }
}
