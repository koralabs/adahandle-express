import { BaseModel } from "./BaseModel";

interface AccessQueueInput {
    email: string;
    attempts?: number;
    sid?: string;
    status?: string;
    start?: number;
    clientAgentSha?: string;
    clientIp?: string;
}

export class AccessQueue extends BaseModel {
    public email: string;
    public dateAdded: number = Date.now();
    public sid?: string;
    public status?: string;
    public start?: number;
    public attempts: number;
    public clientAgentSha?: string;
    public clientIp?: string;

    constructor({ email, sid, start, status = 'queued', attempts = 0, clientAgentSha, clientIp }: AccessQueueInput) {
        super();
        this.email = email;
        this.sid = sid;
        this.start = start
        this.status = status;
        this.attempts = attempts;
        this.clientAgentSha = clientAgentSha;
        this.clientIp = clientIp;
        this.dateAdded = Date.now();
    }
}
