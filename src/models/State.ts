import { BaseModel } from "./BaseModel";

export enum CronState {
    LOCKED = 'LOCKED',
    UNLOCKED = 'UNLOCKED',
    EXECUTING = 'EXECUTING',
    DEPLOYING = 'DEPLOYING'
}

export enum WalletState {
    AVAILABLE = 'AVAILABLE',
    RESERVED = 'RESERVED',
    SUBMITTING = 'SUBMITTING',
    CONFIRMING = 'CONFIRMING'
}

interface StateConstructor {
    updateActiveSessionsLock?: CronState;
    mintPaidSessionsLock?: CronState;
    sendAuthCodesLock?: CronState;
    saveStateLock?: CronState;
    mintConfirmLock?: CronState;
    refundsLock?: CronState;
    chainLoad?: number;
    accessQueueSize: number;
    mintingQueueSize: number;
    totalHandles?: number;
    lastMintingTimestamp?: number;
    lastAccessTimestamp?: number;
    handlePrices?: { basic: number, common: number, rare: number, ultraRare: number }
}

export class State extends BaseModel {
    public updateActiveSessionsLock: CronState;
    public mintPaidSessionsLock: CronState;
    public sendAuthCodesLock: CronState;
    public saveStateLock: CronState;
    public mintConfirmLock: CronState;
    public refundsLock?: CronState;
    public chainLoad: number;
    public totalHandles?: number;
    public accessQueueSize: number;
    public mintingQueueSize: number;
    public lastMintingTimestamp: number;
    public lastAccessTimestamp: number;
    public handlePrices?: { basic: number, common: number, rare: number, ultraRare: number }

    constructor({
        updateActiveSessionsLock,
        sendAuthCodesLock,
        saveStateLock,
        mintConfirmLock,
        mintPaidSessionsLock,
        refundsLock,
        chainLoad,
        totalHandles,
        accessQueueSize,
        mintingQueueSize,
        lastMintingTimestamp = Date.now(),
        lastAccessTimestamp = Date.now(),
        handlePrices = { basic: 10, common: 50, rare: 100, ultraRare: 500 }
    }: StateConstructor) {
        super();
        this.mintPaidSessionsLock = mintPaidSessionsLock ?? CronState.UNLOCKED;
        this.updateActiveSessionsLock = updateActiveSessionsLock ?? CronState.UNLOCKED;
        this.refundsLock = refundsLock ?? CronState.UNLOCKED;
        this.sendAuthCodesLock = sendAuthCodesLock ?? CronState.UNLOCKED;
        this.saveStateLock = saveStateLock ?? CronState.UNLOCKED;
        this.mintConfirmLock = mintConfirmLock ?? CronState.UNLOCKED;
        this.chainLoad = chainLoad ?? 0;
        this.totalHandles = totalHandles;
        this.accessQueueSize = accessQueueSize;
        this.mintingQueueSize = mintingQueueSize;
        this.lastMintingTimestamp = lastMintingTimestamp;
        this.lastAccessTimestamp = lastAccessTimestamp;
        this.handlePrices = handlePrices;
    }
}