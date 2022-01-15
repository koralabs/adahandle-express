import { BaseModel } from "./BaseModel";

interface StateConstructor {
    chainLoad?: number;
    accessQueueSize: number;
    mintingQueueSize: number;
    totalHandles: number;
    updateActiveSessionsLock?: boolean;
    mintPaidSessionsLock?: boolean;
    refundsLock?: boolean;
    accessQueueLimit?: number;
    paidSessionsLimit?: number;
    mintConfirmPaidSessionsLimit?: number;
    usedAddressesLimit?: number;
    ipfsRateDelay?: number;
    lastMintingTimestamp?: number;
    lastAccessTimestamp?: number;
    availableMintingServers?: string;
}

export class State extends BaseModel {
    public chainLoad: number;
    public accessQueueSize: number;
    public mintingQueueSize: number;
    public totalHandles: number;
    public updateActiveSessionsLock: boolean;
    public mintPaidSessionsLock: boolean;
    public refundsLock?: boolean;
    public accessQueueLimit: number;
    public paidSessionsLimit: number;
    public mintConfirmPaidSessionsLimit: number;
    public usedAddressesLimit: number;
    public ipfsRateDelay: number;
    public lastMintingTimestamp: number;
    public lastAccessTimestamp: number;
    public availableMintingServers?: string;

    constructor({
        chainLoad,
        accessQueueSize,
        mintingQueueSize,
        totalHandles,
        updateActiveSessionsLock,
        mintPaidSessionsLock,
        refundsLock,
        accessQueueLimit = 20,
        paidSessionsLimit = 10,
        mintConfirmPaidSessionsLimit = 500,
        usedAddressesLimit = 50,
        ipfsRateDelay = 1000, // <- Blockfrost is 10/sec, Pinata is 3/sec. 2 servers at 1/sec = 2/sec
        lastMintingTimestamp = Date.now(),
        lastAccessTimestamp = Date.now(),
        availableMintingServers = "testnet01,testnet02",
    }: StateConstructor) {
        super();
        this.chainLoad = chainLoad ?? 0;
        this.accessQueueSize = accessQueueSize;
        this.mintingQueueSize = mintingQueueSize;
        this.totalHandles = totalHandles;
        this.mintPaidSessionsLock = mintPaidSessionsLock ?? false;
        this.updateActiveSessionsLock = updateActiveSessionsLock ?? false;
        this.refundsLock = refundsLock ?? false;
        this.accessQueueLimit = accessQueueLimit;
        this.paidSessionsLimit = paidSessionsLimit;
        this.mintConfirmPaidSessionsLimit = mintConfirmPaidSessionsLimit;
        this.usedAddressesLimit = usedAddressesLimit;
        this.ipfsRateDelay = ipfsRateDelay;
        this.lastMintingTimestamp = lastMintingTimestamp;
        this.lastAccessTimestamp = lastAccessTimestamp;
        this.availableMintingServers = availableMintingServers;
    }
}