import * as admin from 'firebase-admin';
import { readFileSync, writeFile } from 'fs';
import { Firebase } from "../helpers/firebase";
import { checkPayments } from '../helpers/graphql';
import { chunk } from '../helpers/utils';
import { PaidSessions } from '../models/firestore/collections/PaidSessions';
import { RefundableSessions } from '../models/firestore/collections/RefundableSessions';
import { WalletAddresses } from '../models/firestore/collections/WalletAddresses';

/**
 * This script is used because it's possible to active sessions to be removed BEFORE they are paid.
 * https://github.com/adahandle/adahandle-internal/issues/48
 * 
 */

const getWalletAddressesFromJSONFile = async () => {
    const file = readFileSync('./src/scripts/fixtures/wallet-addresses.json', 'utf8');
    const json = JSON.parse(file);
    console.log(`address length: ${json.length}`);
    return json;
}

const getCurrentWalletAddressesFromJSONFile = async () => {
    const file = readFileSync('./src/scripts/fixtures/current-wallet-addresses.json', 'utf8');
    const json = JSON.parse(file);
    console.log(`current address length: ${json.length}`);
    return json;
}

const saveCurrentWalletAddresses = async () => {
    const currentWalletAddresses = await WalletAddresses.getWalletAddressesUnsafe();
    writeFile('./src/scripts/fixtures/current-wallet-addresses.txt', JSON.stringify(currentWalletAddresses), (err) => {
        if (err) {
            console.log(err);
        }
        process.exit();
    });
}

const saveLeftOverWalletAddresses = async (addresses: string[]) => {
    writeFile('./src/scripts/fixtures/left-over-wallet-addresses.txt', JSON.stringify(addresses), (err) => {
        if (err) {
            console.log(err);
        }
        process.exit();
    });
}

// const stakeKey = 'stake1ux46gkt0l3n4mta0ssd9urp7r7dm982dw5f7u6kpgpn2t0cjtrg9c';

const run = async () => {
    await Firebase.init();
    // get list of beginning wallet addresses
    const beginningWalletAddresses = await getWalletAddressesFromJSONFile() as { state: string; id: string; derivation_path: string[] }[];
    const beginningAddresses = beginningWalletAddresses.map(address => address.id);

    // get current list of wallet addresses
    const currentWalletAddresses = await getCurrentWalletAddressesFromJSONFile() as { id: string }[];
    const currentAddressMap = new Map(currentWalletAddresses.map(address => [address.id, address]));

    // Save current wallet addresses to file and exit
    //await saveCurrentWalletAddresses();

    // figure out what's missing using the beginning wallet addresses
    const usedWalletAddresses = beginningAddresses.filter(address => !currentAddressMap.get(address));

    console.log(`usedWalletAddresses length ${usedWalletAddresses.length}`);

    // get the current list of paid sessions
    const paidSessions = await PaidSessions.getPaidSessionsUnsafe();
    const paidSessionsDLQ = await PaidSessions.getDLQPaidSessionsUnsafe();

    // get the current list of refundable sessions
    const refundableSessions = await RefundableSessions.getRefundableSessions();

    const allExistingSessions = [...paidSessions, ...paidSessionsDLQ, ...refundableSessions];
    console.log(`allExistingSessions length ${allExistingSessions.length}`);

    const allSessionsMap = new Map(allExistingSessions.map(session => [session.wallet.address, session]));

    // see what addresses are left over that are not in paid sessions and refundable sessions
    const leftOverAddresses = usedWalletAddresses.filter(address => !allSessionsMap.get(address));

    console.log(`leftOverAddresses length ${leftOverAddresses.length}`);

    //saveLeftOverWalletAddresses(leftOverAddresses);
    const addressesThatNeedToBeRefunded: { address: string; returnAddress: string; amount: number }[] = [];
    const addressChunks = chunk(leftOverAddresses, 100);
    for (let i = 0; i < addressChunks.length; i++) {
        const address = addressChunks[i];

        // check to see if payment has been made and if there is no asset
        const results = await checkPayments(address);
        addressesThatNeedToBeRefunded.push(...results.map(result => {
            return {
                address: result.address,
                returnAddress: '',// result.returnAddress,
                amount: result.amount
            }
        }));
    }

    process.exit();
}

run();