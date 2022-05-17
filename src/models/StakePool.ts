import { BaseModel } from "./BaseModel";

export class StakePool extends BaseModel {
    public id: string; // pool id e.g. pool1lvsa...
    public ticker: string;
    public stakeKey: string;
    public ownerHashes: string[] = [];
    public registration?: string[] = [];
    public retirement?: string[] = [];
    public vrfKeyHash?: string;
    public error?: string;
    public isOG: boolean;

    constructor(id: string, ticker: string, stakeKey: string, ownerHashes?: string[], isOG = false) {
        super();
        this.id = id;
        this.ticker = ticker;
        this.stakeKey = stakeKey;
        this.ownerHashes = ownerHashes ?? [];
        this.isOG = isOG;
    }
}