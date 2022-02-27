import * as admin from "firebase-admin";

import { buildCollectionNameWithSuffix } from "./lib/buildCollectionNameWithSuffix";
import { Settings } from "../../Settings";

export class SettingsRepo {
    public static readonly collectionName = buildCollectionNameWithSuffix('stateData');
    public static readonly docName = 'settings';

    public static async getSettings(): Promise<Settings> {
        const doc = await admin.firestore().collection(SettingsRepo.collectionName).doc(SettingsRepo.docName).get();
        return doc.data() as Settings;
    }
}