import { BaseModel } from "./BaseModel";

export interface HandlePrice {
    defaultPrice: number,
    weight: number,
    underPercent: number,
    overPercent: number,
    minimum: number,
    maximum: number
}

interface SettingsConstructor {
    accessQueueLimit?: number;
    paidSessionsLimit?: number;
    mintConfirmPaidSessionsLimit?: number;
    usedAddressesLimit?: number;
    accessCodeTimeoutMinutes?: number;
    accessWindowTimeoutMinutes?: number;
    paymentWindowTimeoutMinutes?: number;
    chainLoadThresholdPercent?: number;
    ipfsRateDelay?: number;
    availableMintingServers?: string;
    spoPageEnabled: boolean,
    dynamicPricingEnabled?: boolean;
    fallBackAdaUsd?: number;
    handlePriceSettings?: {
        basic: HandlePrice,
        common: HandlePrice,
        rare: HandlePrice,
        ultraRare: HandlePrice
    }
    walletAddressCollectionName?: string;
    minimumWalletAddressAmount: number;
}

export class Settings extends BaseModel {
    public accessQueueLimit: number;
    public paidSessionsLimit: number;
    public mintConfirmPaidSessionsLimit: number;
    public usedAddressesLimit: number;
    public accessCodeTimeoutMinutes: number;
    public accessWindowTimeoutMinutes: number;
    public paymentWindowTimeoutMinutes: number;
    public chainLoadThresholdPercent: number;
    public ipfsRateDelay: number;
    public availableMintingServers?: string;
    public spoPageEnabled: boolean;
    public dynamicPricingEnabled?: boolean;
    public fallBackAdaUsd: number;
    public handlePriceSettings?: {
        basic: HandlePrice,
        common: HandlePrice,
        rare: HandlePrice,
        ultraRare: HandlePrice
    }
    public walletAddressCollectionName?: string;
    public minimumWalletAddressAmount: number;

    constructor({
        accessQueueLimit = 20,
        paidSessionsLimit = 10,
        mintConfirmPaidSessionsLimit = 500,
        usedAddressesLimit = 50,
        accessCodeTimeoutMinutes = 60,
        accessWindowTimeoutMinutes = 60,
        paymentWindowTimeoutMinutes = 60,
        chainLoadThresholdPercent = 85,
        ipfsRateDelay = 1000, // <- Blockfrost is 10/sec, Pinata is 3/sec. 2 servers at 1/sec = 2/sec
        availableMintingServers = "testnet01,testnet02",
        spoPageEnabled = true,
        dynamicPricingEnabled = false,
        fallBackAdaUsd = 1.25,
        handlePriceSettings,
        walletAddressCollectionName = "walletAddresses",
        minimumWalletAddressAmount = 10000
    }: SettingsConstructor) {
        super();
        this.accessQueueLimit = accessQueueLimit;
        this.paidSessionsLimit = paidSessionsLimit;
        this.mintConfirmPaidSessionsLimit = mintConfirmPaidSessionsLimit;
        this.usedAddressesLimit = usedAddressesLimit;
        this.accessCodeTimeoutMinutes = accessCodeTimeoutMinutes;
        this.accessWindowTimeoutMinutes = accessWindowTimeoutMinutes;
        this.paymentWindowTimeoutMinutes = paymentWindowTimeoutMinutes;
        this.chainLoadThresholdPercent = chainLoadThresholdPercent;
        this.ipfsRateDelay = ipfsRateDelay;
        this.availableMintingServers = availableMintingServers;
        this.spoPageEnabled = spoPageEnabled;
        this.dynamicPricingEnabled = dynamicPricingEnabled;
        this.fallBackAdaUsd = fallBackAdaUsd;
        this.handlePriceSettings = handlePriceSettings;
        this.walletAddressCollectionName = walletAddressCollectionName;
        this.minimumWalletAddressAmount = minimumWalletAddressAmount;
    }
}