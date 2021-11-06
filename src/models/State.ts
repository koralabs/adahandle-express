import { BaseModel } from "./BaseModel";

export class State extends BaseModel {
    public chainLoad: number;
    public position: number;
    public totalHandles: number;

    constructor({
        chainLoad,
        position,
        totalHandles
    }: {
        chainLoad?: number,
        position: number,
        totalHandles: number
    }) {
        super();
        this.chainLoad = chainLoad ?? 0;
        this.position = position;
        this.totalHandles = totalHandles;
    }
}