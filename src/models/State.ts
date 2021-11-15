import { BaseModel } from "./BaseModel";

interface StateConstructor {
    chainLoad?: number,
    position: number,
    totalHandles: number,
    updateActiveSessions_lock?: boolean,
    accessQueue_limit?: number
}

export class State extends BaseModel {
    public chainLoad: number;
    public position: number;
    public totalHandles: number;
    public updateActiveSessions_lock: boolean;
    public accessQueue_limit: number;

    constructor({
        chainLoad,
        position,
        totalHandles,
        updateActiveSessions_lock,
        accessQueue_limit
    }: StateConstructor) {
        super();
        this.chainLoad = chainLoad ?? 0;
        this.position = position;
        this.totalHandles = totalHandles;
        this.updateActiveSessions_lock = updateActiveSessions_lock ?? false;
        this.accessQueue_limit = accessQueue_limit ?? 20;
    }
}