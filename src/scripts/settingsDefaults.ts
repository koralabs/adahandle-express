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
            overPercent: .14,
            minimum: 1,
            maximum: 15
        },
        common: {
            defaultPrice: 50,
            weight: .44,
            underPercent: .20,
            overPercent: .47,
            minimum: 2,
            maximum: 95
        },
        rare: {
            defaultPrice: 100,
            weight: .13438,
            underPercent: .40,
            overPercent: .125,
            minimum: 3,
            maximum: 445
        },
        ultraRare: {
            defaultPrice: 500,
            weight: .26772,
            underPercent: .30,
            overPercent: .265,
            minimum: 5,
            maximum: 995
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