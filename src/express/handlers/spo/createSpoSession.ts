import { CreatedBySystem } from "../../../helpers/constants";
import { toLovelace } from "../../../helpers/utils";
import { ActiveSession, Status } from "../../../models/ActiveSession";
import { ActiveSessions } from "../../../models/firestore/collections/ActiveSession";
import { SettingsRepo } from "../../../models/firestore/collections/SettingsRepo";
import { WalletAddresses } from "../../../models/firestore/collections/WalletAddresses";

export const createSpoSession = async (handle: string, cost: number): Promise<string | null> => {
    const newSession = new ActiveSession({
        emailAddress: 'spo@adahandle.com',
        handle,
        paymentAddress: '',
        cost: toLovelace(cost),
        start: Date.now(),
        createdBySystem: CreatedBySystem.SPO,
        status: Status.PENDING
    });

    const settings = await SettingsRepo.getSettings();
    const walletAddress = await WalletAddresses.getFirstAvailableWalletAddress(newSession.createdBySystem, settings.walletAddressCollectionName);

    if (!walletAddress) {
        throw new Error('Failed to retrieve payment address data.');
    }

    newSession.paymentAddress = walletAddress.id;
    const added = await ActiveSessions.addActiveSession(newSession);
    if (!added) {
        return null;
    }

    return walletAddress.id
}