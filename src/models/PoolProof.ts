import { BaseModel } from "./BaseModel";

export class PoolProof extends BaseModel {
    public poolId: string;
    public vrfKey: string;
    public vKeyHash: string;
    public start: number;
    public end?: number;
    public nonce: string;
    public signature?: string;

    constructor({ poolId, vrfKey, vKeyHash, start, end, nonce, signature }: { poolId: string, vrfKey: string, vKeyHash: string, start?: number, end?: number, nonce: string, signature?: string }) {
        super();
        this.poolId = poolId;
        this.vrfKey = vrfKey;
        this.vKeyHash = vKeyHash;
        this.start = start ?? Date.now();
        this.end = end;
        this.nonce = nonce;
        this.signature = signature;
    }
}