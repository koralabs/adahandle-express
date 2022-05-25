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
    public isRetired?: boolean;
    public oldestTxIncludedAt?: number;
    public isOG: boolean;

    constructor(id: string, ticker: string, stakeKey: string, ownerHashes?: string[], isOG = false, vrfKeyHash = '', oldestTxIncludedAt = Date.now()) {
        super();
        this.id = id;
        this.ticker = ticker;
        this.stakeKey = stakeKey;
        this.ownerHashes = ownerHashes ?? [];
        this.isOG = isOG;
        this.vrfKeyHash = vrfKeyHash;
        this.oldestTxIncludedAt = oldestTxIncludedAt;
    }
}