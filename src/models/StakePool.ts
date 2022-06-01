import { BaseModel } from './BaseModel';

export interface StakePoolConstructor {
    id: string;
    ticker: string;
    stakeKey: string;
    ownerHashes?: string[];
    isOG: boolean;
    vrfKeyHash?: string;
    oldestTxIncludedAt?: number;
    isRetired?: boolean;
}

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

    constructor({
        id,
        ticker,
        stakeKey,
        ownerHashes = [],
        isOG = false,
        vrfKeyHash = '',
        oldestTxIncludedAt = Date.now(),
        isRetired = false
    }: StakePoolConstructor) {
        super();
        this.id = id;
        this.ticker = ticker;
        this.stakeKey = stakeKey;
        this.ownerHashes = ownerHashes ?? [];
        this.isOG = isOG;
        this.vrfKeyHash = vrfKeyHash;
        this.oldestTxIncludedAt = oldestTxIncludedAt;
        this.isRetired = isRetired;
    }
}
