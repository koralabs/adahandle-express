import { BaseModel } from "./BaseModel";

interface StateConstructor {
    chainLoad?: number,
    position: number,
    totalHandles: number,
    updateActiveSessionsLock?: boolean,
    accessQueueLimit?: number
}

export class State extends BaseModel {
    public chainLoad: number;
    public position: number;
    public totalHandles: number;
    public updateActiveSessionsLock: boolean;
    public accessQueueLimit: number;

    constructor({
        chainLoad,
        position,
        totalHandles,
        updateActiveSessionsLock,
        accessQueueLimit
    }: StateConstructor) {
        super();
        this.chainLoad = chainLoad ?? 0;
        this.position = position;
        this.totalHandles = totalHandles;
        this.updateActiveSessionsLock = updateActiveSessionsLock ?? false;
        this.accessQueueLimit = accessQueueLimit ?? 20;
    }
}