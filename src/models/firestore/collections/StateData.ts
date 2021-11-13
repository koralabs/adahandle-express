import * as admin from "firebase-admin";

import { buildCollectionNameWithSuffix } from "./lib/buildCollectionNameWithSuffix";
import { State } from "../../State";
import { LogCategory, Logger } from "../../../helpers/Logger";

export enum CronJobLockName {
    MINT_PAID_SESSIONS_LOCK = "mintPaidSessions_lock",
    SAVE_STATE_LOCK = "saveState_lock",
    SEND_AUTH_CODES_LOCK = "sendAuthCodes_lock",
    UPDATE_ACTIVE_SESSIONS_LOCK = "updateActiveSessions_lock",
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
        const stateObj = Object.keys(state).reduce((acc, key) => {
            if (key.endsWith('_lock') || key.endsWith('_limit')) {
                return acc;
            }

            if (!acc[key]) {
                acc[key] = state[key];
            }
            return acc;
        }, {});

        if (Object.keys(state).length == 0) {
            Logger.log({ message: 'No state data to save', category: LogCategory.WARN, event: 'upsertStateData' });
            return;
        }

        await admin.firestore().collection(StateData.collectionName).doc(StateData.docName).update(stateObj);
    }

    public static async lockCron(name: CronJobLockName) {
        await admin.firestore().collection(StateData.collectionName).doc(StateData.docName).update({
            [name]: true
        });
    }

    public static async unlockCron(name: CronJobLockName) {
        await admin.firestore().collection(StateData.collectionName).doc(StateData.docName).update({
            [name]: false
        });
    }
}