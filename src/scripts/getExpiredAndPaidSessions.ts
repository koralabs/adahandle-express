/* eslint-disable @typescript-eslint/ban-ts-comment */
import { readFileSync, writeFile } from 'fs';
import { Firebase } from "../helpers/firebase";
import { lookupTransaction } from '../helpers/graphql';
import { getRarityFromLength } from '../helpers/nft';
import { toADA, toLovelace } from '../helpers/utils';
import { PaidSessions } from '../models/firestore/collections/PaidSessions';
import { RefundableSessions } from '../models/firestore/collections/RefundableSessions';
import { UsedAddresses } from '../models/firestore/collections/UsedAddresses';
import { WalletAddresses } from '../models/firestore/collections/WalletAddresses';
import { PaidSession } from '../models/PaidSession';
import { RefundableSession } from '../models/RefundableSession';
import { UsedAddress, UsedAddressStatus } from '../models/UsedAddress';

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

const getUsedAddresses = async (): Promise<string[]> => {
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
    return usedWalletAddresses;
}

const getExistingSessions = async (): Promise<(PaidSession | RefundableSession)[]> => {
    // get the current list of paid sessions
    const paidSessions = await PaidSessions.getPaidSessionsUnsafe();
    const paidSessionsDLQ = await PaidSessions.getDLQPaidSessionsUnsafe();

    // get the current list of refundable sessions
    const refundableSessions = await RefundableSessions.getRefundableSessions();

    const allExistingSessions = [...paidSessions, ...paidSessionsDLQ, ...refundableSessions];
    console.log(`allExistingSessions length ${allExistingSessions.length}`);
    return allExistingSessions;
}

const updateExistingRefundableSessions = async () => {
    const refundableSessions = await RefundableSessions.getRefundableSessions();

    // @ts-expect-error
    const updatePromises = refundableSessions.map(session => UsedAddresses.updateUsedAddressStatus(session.wallet.address, UsedAddressStatus.PROCESSED).then(() => `completed: ${session.wallet.address}`).catch(e => console.log(e)));
    await Promise.all(updatePromises);
}

// const stakeKey = 'stake1ux46gkt0l3n4mta0ssd9urp7r7dm982dw5f7u6kpgpn2t0cjtrg9c';

const getBalances = async (usedAddress: UsedAddress, index: number): Promise<number | null> => {
    // check to see if payment has been made and if there is no asset
    console.log(`started processing address ${index}`);
    let results;
    try {
        results = await lookupTransaction(usedAddress.id);
    } catch (error) {
        console.log(`error on address: ${usedAddress.id}`);
    }

    if (!results) {
        return null;
    }

    if (results.totalPayments === 0) {
        console.log(`${usedAddress.id} has no payments`);
        //await UsedAddresses.updateUsedAddressStatus(usedAddress.id, UsedAddressStatus.PROCESSED);
    } else {
        const paymentSession = await PaidSessions.getPaidSessionByWalletAddress(usedAddress.id);
        const balance = results.totalPayments - toLovelace(paymentSession?.cost ?? 0);
        if (balance > 0) {
            // need to refund balance
            console.log(`${usedAddress.id} with returnAddress ${results.returnAddress} has balance of ${toADA(balance)} for transaction ${paymentSession?.txId ?? 'unknown'}`);
            return balance;
        } else {
            console.log(`${usedAddress.id} has zero balance`);
            //await UsedAddresses.updateUsedAddressStatus(usedAddress.id, UsedAddressStatus.PROCESSED);
        }
    }

    return null;
}

const run = async () => {
    await Firebase.init();

    const paidSessions = await PaidSessions.getPaidSessionsUnsafe();
    console.log(`paidSessions length ${paidSessions.length}`);

    // get rarity
    const buildRarity = paidSessions.reduce<Record<string, { total: number, percentage: number }>>((acc, session) => {
        const handle = session.handle;
        const rarity = getRarityFromLength(handle.length);
        acc[rarity] = {
            total: acc[rarity].total + 1,
            percentage: paidSessions.length / acc[rarity].total + 1
        };

        return acc;
    },
        { Common: { total: 0, percentage: 0 }, Basic: { total: 0, percentage: 0 }, Rare: { total: 0, percentage: 0 }, 'Ultra Rare': { total: 0, percentage: 0 } });

    console.log('buildRarity', buildRarity);

    // const refundableAddresses = await UsedAddresses.getRefundableAddresses();
    // console.log(`refundableAddresses length ${refundableAddresses.length}`);

    // const refundedSessions = await RefundableSessions.getRefundableSessions();
    // console.log(`refundableAddresses length ${refundedSessions.length}`);

    // console.log(refundableAddresses.length + refundedSessions.length);

    // process.exit();

    // const refundAmountSum = refundedSessions.reduce((sum, session) => sum + session.amount, 0);
    // console.log('refundAmountSum', toADA(refundAmountSum));

    // try {
    //     const addresses = await UsedAddresses.getRefundableAddresses();
    //     console.log(`addresses length ${addresses.length}`);
    // } catch (error) {
    //     console.log('error', error);
    // }

    // const usedWalletAddresses = await getUsedAddresses()

    // const allExistingSessions = await getExistingSessions();

    // // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // // @ts-expect-error
    // const allSessionsMap = new Map(allExistingSessions.map(session => [session.wallet.address, session]));

    // // see what addresses are left over that are not in paid sessions and refundable sessions
    // const leftOverAddresses = usedWalletAddresses.filter(address => !allSessionsMap.get(address));
    // console.log(`leftOverAddresses length ${leftOverAddresses.length}`);

    // // //saveLeftOverWalletAddresses(leftOverAddresses);
    // // const leftOverAddresses = addresses.map(address => address.id);
    // let totalAda = 0
    // const paidAddressesWithoutHandles: string[] = [];

    // const balancesSum = await refundableAddresses.reduce<Promise<number>>(async (sum, address, index) => {
    //     const awaitSum = await sum;
    //     const balance = await getBalances(address, index);
    //     if (balance) {
    //         return awaitSum + balance;
    //     }
    //     return awaitSum;
    // }, Promise.resolve(0));

    // console.log('balancesSum', toADA(balancesSum));
    // console.log(`total refund amount: ${toADA(refundAmountSum + balancesSum)}`)

    //await awaitForEach(refundableAddresses, (address, index) => getBalances(address, index));

    // for (let i = 0; i < refundableAddresses.length; i++) {
    //     const usedAddress = refundableAddresses[i];
    //     console.log(`checking ${usedAddress.id} addresses`);

    //     // check to see if payment has been made and if there is no asset
    //     const results = await lookupTransaction(usedAddress.id);
    //     if (results.totalPayments === 0) {
    //         console.log(`${usedAddress.id} has no payments`);
    //     } else {
    //         const paymentSession = await PaidSessions.getPaidSessionByWalletAddress(usedAddress.id);
    //         const balance = results.totalPayments - toLovelace(paymentSession?.cost ?? 0);
    //         if (balance > 0) {
    //             // need to refund balance
    //             console.log('balance', toADA(balance));
    //         }
    //     }
    // }

    // console.log('totalAda', totalAda);
    // console.log('paidAddressesWithoutHandles', paidAddressesWithoutHandles);

    process.exit();
}

run();