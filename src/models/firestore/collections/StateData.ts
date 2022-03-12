import * as admin from "firebase-admin";

import { buildCollectionNameWithSuffix } from "./lib/buildCollectionNameWithSuffix";
import { CronState, State } from "../../State";
import { LogCategory, Logger } from "../../../helpers/Logger";

export type CronJobLockName = "mintPaidSessionsLock" | "saveStateLock" | "sendAuthCodesLock" | "updateActiveSessionsLock" | "mintConfirmLock" | "refundsLock";

export interface MintingWallet {
    id: string;
    index: number;
    locked: boolean;
    txId?: string;
    balance?: number;
    minBalance: number;
    updatedTimestamp: string;
}

export class StateData {
    public static readonly collectionName = buildCollectionNameWithSuffix('stateData');
    public static readonly docName = 'state';

    public static async getStateData(): Promise<State> {
        const doc = await admin.firestore().collection(StateData.collectionName).doc(StateData.docName).get();
        return doc.data() as State;
    }
    public static async upsertStateData(state: State): Promise<void> {
        const stateObj = Object.keys(state).reduce((acc, key) => {
            if (key.endsWith('Lock')) {
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
        if (state[name] == CronState.EXECUTING) {
            Logger.log({ message: `Cron job ${name} is delayed in execution`, event: `${name}.locked`, category: LogCategory.NOTIFY });
            return false;
        }
        if (state[name] == CronState.DEPLOYING) {
            Logger.log({ message: `Cron job ${name} is DEPLOYING`, event: `${name}.locked`, category: LogCategory.INFO });
            return false;
        }
        if (state[name] == CronState.LOCKED) {
            Logger.log({ message: `Cron job ${name} is manually locked`, event: `${name}.locked`, category: LogCategory.INFO });
            return false;
        }
        await StateData.lockCron(name);
        return true;

    }

    public static async lockCron(name: CronJobLockName) {
        await admin.firestore().collection(StateData.collectionName).doc(StateData.docName).update({
            [name]: CronState.EXECUTING
        });
    }


    public static async lockMintingCron() {
        await admin.firestore().collection(StateData.collectionName).doc(StateData.docName).update({
            'mintPaidSessionsLock': CronState.LOCKED
        });
    }

    public static async unlockCron(name: CronJobLockName) {
        await admin.firestore().collection(StateData.collectionName).doc(StateData.docName).update({
            [name]: CronState.UNLOCKED
        });
    }

    public static async getMintingWallets(): Promise<MintingWallet[]> {
        const snapshot = await admin.firestore().collection(StateData.collectionName).get();

        const mintingWallets = snapshot.docs.filter(doc => doc.id.startsWith('wallet'));
        return mintingWallets.map(doc => ({ ...doc.data(), id: doc.id } as MintingWallet));
    }

    static updateMintingWalletBalance(id: string, walletBalance: number) {
        return admin.firestore().runTransaction(async t => {
            const snapshot = await t.get(admin.firestore().collection(StateData.collectionName).doc(id));
            t.update(snapshot.ref, { balance: walletBalance });
            return true;
        });
    }

    static async findAvailableMintingWallet(): Promise<MintingWallet | null> {
        return admin.firestore().runTransaction(async t => {
            const snapshot = await t.get(admin.firestore().collection(StateData.collectionName));

            const wallet = snapshot.docs.find(doc => {
                const d = doc.data();
                return doc.id.startsWith('wallet') && !d.locked;
            });

            if (wallet) {
                t.update(wallet.ref, { locked: true });
                return { ...wallet.data(), id: wallet.id } as MintingWallet;
            }

            return null;
        });
    }

    static async unlockMintingWallet(availableWallet: MintingWallet | null): Promise<void> {
        if (!availableWallet) {
            return;
        }

        return admin.firestore().runTransaction(async t => {
            const snapshot = await t.get(admin.firestore().collection(StateData.collectionName).doc(availableWallet.id));
            t.update(snapshot.ref, { locked: false });
        });
    }

    static async unlockMintingWalletByTxId(txId: string): Promise<void> {
        return admin.firestore().runTransaction(async t => {
            const snapshot = await t.get(admin.firestore().collection(StateData.collectionName).where('txId', '==', txId).limit(1));
            if (snapshot.empty) {
                return;
            }

            t.update(snapshot.docs[0].ref, { txId: '', locked: false });
        });
    }

    static async updateMintingWalletTxId(availableWallet: MintingWallet, txId: string): Promise<void> {
        return admin.firestore().runTransaction(async t => {
            const snapshot = await t.get(admin.firestore().collection(StateData.collectionName).doc(availableWallet.id));
            snapshot.ref.update({ txId });
        });
    }
}