import { BaseModel } from "./BaseModel";

interface StateConstructor {
    updateActiveSessionsLock?: boolean;
    mintPaidSessionsLock?: boolean;
    sendAuthCodesLock?: boolean;
    saveStateLock?: boolean;
    mintConfirmLock?: boolean;
    refundsLock?: boolean;
    chainLoad?: number;
    accessQueueSize: number;
    mintingQueueSize: number;
    totalHandles?: number;
    lastMintingTimestamp?: number;
    lastAccessTimestamp?: number;
    handlePrices?: {basic: number, common: number, rare: number, ultraRare: number}
    walletAddressCollectionName?: string;
}

export class State extends BaseModel {
    public updateActiveSessionsLock: boolean;
    public mintPaidSessionsLock: boolean;
    public sendAuthCodesLock: boolean;
    public saveStateLock: boolean;
    public mintConfirmLock: boolean;
    public refundsLock?: boolean;
    public chainLoad: number;
    public totalHandles?: number;
    public accessQueueSize: number;
    public mintingQueueSize: number;
    public lastMintingTimestamp: number;
    public lastAccessTimestamp: number;
    public handlePrices?: {basic: number, common: number, rare: number, ultraRare: number}
    public walletAddressCollectionName?: string;

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
        handlePrices = {basic: 10, common: 50, rare: 100, ultraRare: 500},
        walletAddressCollectionName = "walletAddresses"
    }: StateConstructor) {
        super();
        this.mintPaidSessionsLock = mintPaidSessionsLock ?? false;
        this.updateActiveSessionsLock = updateActiveSessionsLock ?? false;
        this.refundsLock = refundsLock ?? false;
        this.sendAuthCodesLock = sendAuthCodesLock ?? false;
        this.saveStateLock = saveStateLock ?? false;
        this.mintConfirmLock = mintConfirmLock ?? false;
        this.chainLoad = chainLoad ?? 0;
        this.totalHandles = totalHandles;
        this.accessQueueSize = accessQueueSize;
        this.mintingQueueSize = mintingQueueSize;
        this.lastMintingTimestamp = lastMintingTimestamp;
        this.lastAccessTimestamp = lastAccessTimestamp;
        this.handlePrices = handlePrices;
        this.walletAddressCollectionName = walletAddressCollectionName;
    }
}