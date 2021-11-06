import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { Firebase } from '../../helpers/firebase';
import { addWalletsToFirebase } from './addWalletsToFirebase';

const getWalletAddressesFromJSONFile = async () => {
    const file = readFileSync('./src/scripts/fixtures/wallet-addresses.json', 'utf8');
    const json = JSON.parse(file);
    console.log(`importing: ${json.length} addresses`);
    return json;
}

const run = async () => {
    try {
        await Firebase.init();
        const walletAddresses = await getWalletAddressesFromJSONFile();
        await addWalletsToFirebase(walletAddresses);
    } catch (error) {
        console.log('ERROR', error);
        process.exit(1);
    }
}

run();