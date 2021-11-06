import * as admin from "firebase-admin";

export interface HandleOptions {
    blacklist: string[];
    manual: string[];
    spos: string[];
    twitter: string[];
}

export class ReservedHandles {
    static readonly collectionName = 'reservedHandles';

    static async getReservedHandles(): Promise<HandleOptions> {
        const reservedHandles = await admin.firestore().collection(ReservedHandles.collectionName).get();
        const handles = reservedHandles.docs.map(doc => doc.data() as HandleOptions);

        if (handles.length === 0) {
            throw new Error('No reserved handles found');
        }

        return handles[0];
    }
}