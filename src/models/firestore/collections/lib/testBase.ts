import * as admin from "firebase-admin";

export const cleanupTesting = async (db: admin.firestore.Firestore, app: admin.app.App, { collections }: { collections: string[] }): Promise<void> => {
    await Promise.all(collections.map(async (collectionName) => {
        const snapshot = await db.collection(collectionName).get();
        return Promise.all([snapshot.docs.forEach(doc => {
            return doc.ref.delete();
        })]);
    }));

    await app.delete();
}

export const initTesting = (): {
    app: admin.app.App;
    db: admin.firestore.Firestore;
} => {
    const app = admin.initializeApp({
        projectId: "ada-handle-reserve",
    });

    const db = admin.firestore();
    db.settings({
        host: "localhost:8080",
        ssl: false
    });

    return {
        app,
        db
    }
}