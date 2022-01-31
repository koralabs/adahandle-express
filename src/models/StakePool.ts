import { BaseModel } from "./BaseModel";

export class StakePool extends BaseModel {
    public id: string; // pool id e.g. pool1lvsa...
    public ticker: string;
    public stakeKey: string;
    public ownerHashes: string[] = [];

    constructor(id: string, ticker: string, stakeKey: string, ownerHashes?: string[]) {
        super();
        this.id = id;
        this.ticker = ticker;
        this.stakeKey = stakeKey;
        this.ownerHashes = ownerHashes ?? [];
    }
}