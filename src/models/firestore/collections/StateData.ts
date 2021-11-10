import * as admin from "firebase-admin";

import { buildCollectionNameWithSuffix } from "./lib/buildCollectionNameWithSuffix";
import { State } from "../../State";

export enum CronJobLockName {
    MINT_PAID_SESSIONS_LOCK = "mintPaidSessionsLock",
    SAVE_STATE_LOCK = "saveStateLock",
    SEND_AUTH_CODES_LOCK = "sendAuthCodesLock",
    UPDATE_ACTIVE_SESSIONS_LOCK = "updateActiveSessionsLock",
}

export class StateData {
    public static readonly collectionName = buildCollectionNameWithSuffix('stateData');
    public static readonly docName = 'state';

    static async getStateData(): Promise<State> {
        const doc = await admin.firestore().collection(StateData.collectionName).doc(StateData.docName).get();
        const state = doc.data();

        if (!state) {
            throw new Error('Unable to find state');
        }

        return state as State;
    }

    public static async upsertStateData(state: State): Promise<void> {
        await admin.firestore().collection(StateData.collectionName).doc(StateData.docName).set(state.toJSON());
    }

    public static async lockCron(name: CronJobLockName) {
        await admin.firestore().collection(StateData.collectionName).doc(StateData.docName).update({
            [name]: false
        });
    }

    public static async unlockCron(name: CronJobLockName) {
        await admin.firestore().collection(StateData.collectionName).doc(StateData.docName).update({
            [name]: false
        });
    }
}