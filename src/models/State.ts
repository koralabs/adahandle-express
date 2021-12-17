import { BaseModel } from "./BaseModel";

export enum CollectionLimitName {
    ACCESS_QUEUE_LIMIT = "accessQueue_limit",
    PAID_SESSIONS_LIMIT = "paidSessions_limit",
    MINT_CONFIRMED_PAID_SESSIONS_LIMIT = "mintConfirmPaidSessions_limit",
}

interface StateConstructor {
    chainLoad?: number;
    position: number;
    totalHandles: number;
    updateActiveSessions_lock?: boolean;
    mintPaidSessions_lock?: boolean;
    accessQueue_limit?: number;
    paidSessions_limit?: number;
    mintConfirmPaidSessions_limit?: number;
}

export class State extends BaseModel {
    public chainLoad: number;
    public position: number;
    public totalHandles: number;
    public updateActiveSessions_lock: boolean;
    public mintPaidSessions_lock: boolean;
    public accessQueue_limit: number;
    public paidSessions_limit: number;
    public mintConfirmPaidSessions_limit: number;

    constructor({
        chainLoad,
        position,
        totalHandles,
        updateActiveSessions_lock,
        mintPaidSessions_lock,
        accessQueue_limit = 20,
        paidSessions_limit = 10,
        mintConfirmPaidSessions_limit = 500,
    }: StateConstructor) {
        super();
        this.chainLoad = chainLoad ?? 0;
        this.position = position;
        this.totalHandles = totalHandles;
        this.mintPaidSessions_lock = mintPaidSessions_lock ?? false;
        this.updateActiveSessions_lock = updateActiveSessions_lock ?? false;
        this.accessQueue_limit = accessQueue_limit;
        this.paidSessions_limit = paidSessions_limit;
        this.mintConfirmPaidSessions_limit = mintConfirmPaidSessions_limit;
    }
}