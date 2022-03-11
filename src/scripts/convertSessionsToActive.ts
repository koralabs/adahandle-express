import * as admin from "firebase-admin";
import { CreatedBySystem } from "../helpers/constants";
import { Firebase } from "../helpers/firebase";
import { asyncForEach } from "../helpers/utils";
import { ActiveSession, Status } from "../models/ActiveSession";
import { ActiveSessions } from "../models/firestore/collections/ActiveSession";
import { buildCollectionNameWithSuffix } from '../models/firestore/collections/lib/buildCollectionNameWithSuffix'

const doAllTheCunverzhuns = async () => {
    try {
        await Firebase.init();
        const paidSessions = await admin.firestore().collection(buildCollectionNameWithSuffix("paidSessions")).get();
        console.log(`paidSessions.size = ${paidSessions.size}`)
        const refundSessions = await admin.firestore().collection(buildCollectionNameWithSuffix("refundableSessions")).get();
        console.log(`refundSessions.size = ${refundSessions.size}`)
        await asyncForEach(paidSessions.docs, async (session) => {
            console.log(`processing paidSession ${session.id}`);
            await admin.firestore().collection(ActiveSessions.collectionName).add(new ActiveSession(
            {
                cost: session.get('cost'),
                attempts: session.get('attempts'),
                createdBySystem: CreatedBySystem.UI,
                emailAddress: '',
                handle: session.get('handle'),
                paymentAddress: session.get('wallet.address'),
                start: session.get('start'),
                dateAdded: session.get('dateAdded'),
                txId: session.get('txId'),
                status: Status.PAID,
                workflowStatus: session.get('status')
            }
        ).toJSON())},1);
        await asyncForEach(refundSessions.docs, async (session) => {
            console.log(`processing refundSession ${session.id}`);
            await admin.firestore().collection(ActiveSessions.collectionName).add(new ActiveSession(
            {
                cost: 0,
                attempts: 0,
                createdBySystem: CreatedBySystem.UI,
                emailAddress: '',
                handle: session.get('handle'),
                paymentAddress: session.get('wallet.address'),
                start: Date.now(),
                dateAdded: Date.now(),
                txId: session.get('txId'),
                refundAmount: session.get('amount'),
                status: Status.REFUNDABLE,
                workflowStatus: session.get('status')
            }
        ).toJSON())},1);
    }
    catch (e) {
        console.log(e);
    }
}

doAllTheCunverzhuns();