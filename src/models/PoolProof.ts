import { BaseModel } from "./BaseModel";

export class PoolProof extends BaseModel {
    public poolId: string;
    public vrfKey: string;
    public vKeyHash: string;
    public start: number;
    public end?: number;
    public nonce: string;
    public proof?: string;

    constructor({ poolId, vrfKey, vKeyHash, start, end, nonce, proof }: { poolId: string, vrfKey: string, vKeyHash: string, start?: number, end?: number, nonce: string, proof?: string }) {
        super();
        this.poolId = poolId;
        this.vrfKey = vrfKey;
        this.vKeyHash = vKeyHash;
        this.start = start ?? Date.now();
        this.end = end;
        this.nonce = nonce;
        this.proof = proof;
    }
}