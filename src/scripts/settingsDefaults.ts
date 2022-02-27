import { Firebase } from "../helpers/firebase";
import * as admin from "firebase-admin";

const defaultSettings = {
    mintConfirmPaidSessionsLimit: 500,
    dynamicPricingEnabled: false,
    paidSessionsLimit: 28,
    accessCodeTimeoutMinutes: 60,
    availableMintingServers: 'testnet01,testnet02',
    usedAddressesLimit: 50,
    accessQueueLimit: 10000,
    chainLoadThresholdPercent: 95,
    ipfsRateDelay: 350,
    fallBackAdaUsd: 0.92,
    accessWindowTimeoutMinutes: 60,
    paymentWindowTimeoutMinutes: 240,
    spoPageEnabled: true,
    handlePriceSettings: {
        basic: {
            defaultPrice: 10,
            weight: .16,
            underPercent: .10,
            overPercent: .19,
            minimum: 1,
            maximum: 20
        },
        common: {
            defaultPrice: 50,
            weight: .44,
            underPercent: .20,
            overPercent: .42,
            minimum: 2,
            maximum: 200
        },
        rare: {
            defaultPrice: 100,
            weight: .13,
            underPercent: .40,
            overPercent: .13,
            minimum: 3,
            maximum: 500
        },
        ultraRare: {
            defaultPrice: 500,
            weight: .27,
            underPercent: .30,
            overPercent: .26,
            minimum: 4,
            maximum: 1500
        }
    },
    walletAddressCollectionName: 'walletAddreses'
}

const setDefaults = async () => {
    await Firebase.init();
    await admin.firestore().collection("stateData_dev").doc('settings').update(defaultSettings);
    const doc = await admin.firestore().collection("stateData_dev")
        .doc('settings')
        .get();
    console.log(doc.data());
}
setDefaults();