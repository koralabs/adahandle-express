import { BaseModel } from "./BaseModel";

interface StateConstructor {
    chainLoad?: number;
    position: number;
    totalHandles: number;
    updateActiveSessions_lock?: boolean;
    mintPaidSessions_lock?: boolean;
    accessQueue_limit?: number;
    paidSessions_limit?: number;
    ipfsRate_delay?: number;
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
    public ipfsRate_delay: number;
    public mintConfirmPaidSessions_limit: number;

    constructor({
        chainLoad,
        position,
        totalHandles,
        updateActiveSessions_lock,
        mintPaidSessions_lock,
        accessQueue_limit = 20,
        paidSessions_limit = 10,
        ipfsRate_delay = 1000, // <- Blockfrost is 10/sec, Pinata is 3/sec. 2 servers at 1/sec = 2/sec
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
        this.ipfsRate_delay = ipfsRate_delay;
        this.mintConfirmPaidSessions_limit = mintConfirmPaidSessions_limit;
    }
}