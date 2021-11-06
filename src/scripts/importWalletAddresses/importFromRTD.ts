import * as admin from 'firebase-admin';
import { Firebase } from '../../helpers/firebase';
import { addWalletsToFirebase } from './addWalletsToFirebase';

const getAllWalletsFromRTDB = async () => {
    const db = admin.database();
    const wallets = await db.ref('/wallet1').get().then(res => res.val());
    return wallets;
}

const run = async () => {
    try {
        await Firebase.init();
        const walletAddresses = await getAllWalletsFromRTDB();
        await addWalletsToFirebase(walletAddresses);
        process.exit();
    } catch (error) {
        console.log('ERROR', error);
        process.exit(1);
    }
}

run();