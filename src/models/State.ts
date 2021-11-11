import { BaseModel } from "./BaseModel";

interface StateConstructor {
    chainLoad?: number,
    position: number,
    totalHandles: number,
    updateActiveSessions_lock?: boolean,
    accessQueueLimit?: number
}

export class State extends BaseModel {
    public chainLoad: number;
    public position: number;
    public totalHandles: number;
    public updateActiveSessions_lock: boolean;
    public accessQueueLimit: number;

    constructor({
        chainLoad,
        position,
        totalHandles,
        updateActiveSessions_lock,
        accessQueueLimit
    }: StateConstructor) {
        super();
        this.chainLoad = chainLoad ?? 0;
        this.position = position;
        this.totalHandles = totalHandles;
        this.updateActiveSessions_lock = updateActiveSessions_lock ?? false;
        this.accessQueueLimit = accessQueueLimit ?? 20;
    }
}