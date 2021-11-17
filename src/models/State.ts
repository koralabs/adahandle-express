import { BaseModel } from "./BaseModel";

export enum CollectionLimitName {
    ACCESS_QUEUE_LIMIT = "accessQueue_limit",
    PAID_SESSIONS_LIMIT = "paidSessions_limit",
}

interface StateConstructor {
    chainLoad?: number;
    position: number;
    totalHandles: number;
    updateActiveSessions_lock?: boolean;
    accessQueue_limit?: number;
    paidSessions_limit?: number;
}

export class State extends BaseModel {
    public chainLoad: number;
    public position: number;
    public totalHandles: number;
    public updateActiveSessions_lock: boolean;
    public accessQueue_limit: number;
    public paidSessions_limit: number;

    constructor({
        chainLoad,
        position,
        totalHandles,
        updateActiveSessions_lock,
        accessQueue_limit = 20,
        paidSessions_limit = 10
    }: StateConstructor) {
        super();
        this.chainLoad = chainLoad ?? 0;
        this.position = position;
        this.totalHandles = totalHandles;
        this.updateActiveSessions_lock = updateActiveSessions_lock ?? false;
        this.accessQueue_limit = accessQueue_limit;
        this.paidSessions_limit = paidSessions_limit;
    }
}