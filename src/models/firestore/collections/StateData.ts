import * as admin from "firebase-admin";

import { buildCollectionNameWithSuffix } from "./lib/buildCollectionNameWithSuffix";
import { State } from "../../State";

export class StateData {
    public static readonly collectionName = buildCollectionNameWithSuffix('stateData');

    static async getStateData(): Promise<State> {
        const doc = await admin.firestore().collection(StateData.collectionName).doc('state').get();
        const state = doc.data();

        if (!state) {
            throw new Error('Unable to find state');
        }

        return state as State;
    }

    public static async upsertStateData(state: State): Promise<void> {
        await admin.firestore().collection(StateData.collectionName).doc('state').set(state.toJSON());
    }
}