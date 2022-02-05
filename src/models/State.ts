import { BaseModel } from "./BaseModel";

interface StateConstructor {
    chainLoad?: number;
    accessQueueSize: number;
    mintingQueueSize: number;
    totalHandles?: number;
    updateActiveSessionsLock?: boolean;
    mintPaidSessionsLock?: boolean;
    sendAuthCodesLock?: boolean;
    saveStateLock?: boolean;
    mintConfirmLock?: boolean;
    refundsLock?: boolean;
    accessQueueLimit?: number;
    paidSessionsLimit?: number;
    mintConfirmPaidSessionsLimit?: number;
    usedAddressesLimit?: number;
    accessCodeTimeoutMinutes?: number;
    accessWindowTimeoutMinutes?: number;
    chainLoadThresholdPercent?: number;
    ipfsRateDelay?: number;
    lastMintingTimestamp?: number;
    lastAccessTimestamp?: number;
    availableMintingServers?: string;
}

export class State extends BaseModel {
    public chainLoad: number;
    public totalHandles?: number;
    public accessQueueSize: number;
    public mintingQueueSize: number;
    public updateActiveSessionsLock: boolean;
    public mintPaidSessionsLock: boolean;
    public sendAuthCodesLock: boolean;
    public saveStateLock: boolean;
    public mintConfirmLock: boolean;
    public refundsLock?: boolean;
    public accessQueueLimit: number;
    public paidSessionsLimit: number;
    public mintConfirmPaidSessionsLimit: number;
    public usedAddressesLimit: number;
    public accessCodeTimeoutMinutes: number;
    public accessWindowTimeoutMinutes: number;
    public chainLoadThresholdPercent: number;
    public ipfsRateDelay: number;
    public lastMintingTimestamp: number;
    public lastAccessTimestamp: number;
    public availableMintingServers?: string;

    constructor({
        chainLoad,
        totalHandles,
        accessQueueSize,
        mintingQueueSize,
        updateActiveSessionsLock,
        sendAuthCodesLock,
        saveStateLock,
        mintConfirmLock,
        mintPaidSessionsLock,
        refundsLock,
        accessQueueLimit = 20,
        paidSessionsLimit = 10,
        mintConfirmPaidSessionsLimit = 500,
        usedAddressesLimit = 50,
        accessCodeTimeoutMinutes = 60,
        accessWindowTimeoutMinutes = 60,
        chainLoadThresholdPercent = 85,
        ipfsRateDelay = 1000, // <- Blockfrost is 10/sec, Pinata is 3/sec. 2 servers at 1/sec = 2/sec
        lastMintingTimestamp = Date.now(),
        lastAccessTimestamp = Date.now(),
        availableMintingServers = "testnet01,testnet02",
    }: StateConstructor) {
        super();
        this.chainLoad = chainLoad ?? 0;
        this.totalHandles = totalHandles;
        this.accessQueueSize = accessQueueSize;
        this.mintingQueueSize = mintingQueueSize;
        this.mintPaidSessionsLock = mintPaidSessionsLock ?? false;
        this.updateActiveSessionsLock = updateActiveSessionsLock ?? false;
        this.refundsLock = refundsLock ?? false;
        this.sendAuthCodesLock = sendAuthCodesLock ?? false;
        this.saveStateLock = saveStateLock ?? false;
        this.mintConfirmLock = mintConfirmLock ?? false;
        this.accessQueueLimit = accessQueueLimit;
        this.paidSessionsLimit = paidSessionsLimit;
        this.mintConfirmPaidSessionsLimit = mintConfirmPaidSessionsLimit;
        this.usedAddressesLimit = usedAddressesLimit;
        this.accessCodeTimeoutMinutes = accessCodeTimeoutMinutes;
        this.accessWindowTimeoutMinutes = accessWindowTimeoutMinutes;
        this.chainLoadThresholdPercent = chainLoadThresholdPercent;
        this.ipfsRateDelay = ipfsRateDelay;
        this.lastMintingTimestamp = lastMintingTimestamp;
        this.lastAccessTimestamp = lastAccessTimestamp;
        this.availableMintingServers = availableMintingServers;
    }
}