import * as admin from 'firebase-admin';
import { Firebase } from '../helpers/firebase';
import { handleExists } from '../helpers/graphql';
import { getFingerprint } from '../helpers/utils';
import { Status } from '../models/ActiveSession';
import { ActiveSessions } from '../models/firestore/collections/ActiveSession';
import { MintingCache } from '../models/firestore/collections/MintingCache';

const handleName = 'bigirishlion';

const run = async () => {
    await Firebase.init();
    // get session from DB by handle
    console.log(ActiveSessions.collectionName);
    const sessions = await ActiveSessions.getByHandle(handleName);

    const [session] = sessions;

    console.log(session);

    if (!session || !session.id) {
        throw Error('No Session Found');
    }

    const fingerPrint = getFingerprint(handleName);
    console.log('fingerPrint', fingerPrint);

    // verify the handle has not been minted, (No Double Mints)
    const { exists: existsOnChain } = await handleExists(handleName);
    const existingSessions = await ActiveSessions.getByHandle(handleName);
    const isAdded = await MintingCache.addHandleToMintCache(handleName);
    const inMintingCache = isAdded === false;
    const hasPaidSessions = existingSessions.filter((s) => s.status === Status.PAID).length > 1;
    if (existsOnChain || hasPaidSessions || inMintingCache) {
        console.log('Handle Aready Exists', existsOnChain, hasPaidSessions, inMintingCache);
        process.exit(0);
    }

    console.log(`Updating Session ${session.id}`);

    // // if not,
    // //  update start to now
    // const start = new Date().getTime();
    // //  remove ipfsHash property
    // const ipfsHash = '';
    // //  update workflowStatus to pending
    // const workflowStatus = 'pending';
    // //  remove txId
    // const txId = '';

    // await admin.firestore().runTransaction(async (t) => {
    //     const ref = admin
    //         .firestore()
    //         .collection(ActiveSessions.collectionName)
    //         .doc(session.id as string);
    //     t.update(ref, { start, ipfsHash, workflowStatus, txId });
    //     return true;
    // });
};

try {
    run();
} catch (error) {
    console.log('Error');
}
