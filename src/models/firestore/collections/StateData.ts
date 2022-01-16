import * as admin from "firebase-admin";

import { buildCollectionNameWithSuffix } from "./lib/buildCollectionNameWithSuffix";
import { State } from "../../State";
import { LogCategory, Logger } from "../../../helpers/Logger";

export type CronJobLockName = "mintPaidSessionsLock" | "saveStateLock" | "sendAuthCodesLock" | "updateActiveSessionsLock" | "mintConfirmLock" | "refundsLock"

export class StateData {
    public static readonly collectionName = buildCollectionNameWithSuffix('stateData');
    public static readonly docName = 'state';

    public static async getStateData(): Promise<State> {
        const doc = await admin.firestore().collection(StateData.collectionName).doc(StateData.docName).get();
        return doc.data() as State;
    }

    public static async upsertStateData(state: State): Promise<void> {
        const stateObj = Object.keys(state).reduce((acc, key) => {
            if (key.endsWith('Lock') || key.endsWith('Limit')) {
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

    public static async checkAndLockCron(name: CronJobLockName): Promise<boolean> {
        const state = await StateData.getStateData();
        console.log(`looking at ${name} = ${state[name]}`);
        if (state[name] == true) {
          Logger.log({ message: `Cron job ${name} is locked`, event: `{name}.locked`, category: LogCategory.NOTIFY });
          return false;
        }
        await StateData.lockCron(name);
        return true;

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