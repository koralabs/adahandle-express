import * as admin from "firebase-admin"
import { mocked } from 'ts-jest/utils';
import { getNewAddress } from '.';
import { WalletAddresses } from '../../models/firestore/collections/WalletAddresses';
import { WalletAddress } from '../../models/WalletAddress';
import { LogCategory, Logger } from "../../helpers/Logger";
import { CreatedBySystem } from "../constants";

jest.mock('firebase-admin');
jest.mock('../../models/firestore/collections/WalletAddresses');

/**
 * Main describe function that wraps all other functions
 * Format: "File Name Tests"
 */
describe('Wallet Index Tests', () => {
    /**
     * jest.spy is used to mock functions and later check what there input was using `.toHaveBeenCalledWith("expected")`
     */
    const consoleLogSpy = jest.spyOn(Logger, 'log').mockImplementation();

    /**
     * Individual describe functions are used for each exported function
     * Format: "functionName Tests"
     */
    describe('getNewAddress Tests', () => {
        const WalletAddressesFixture = new WalletAddress('abc123');

        it('should return a new address', async () => {
            /**
             * the mocked function is used to mock the return value of the function.
             */
            mocked(WalletAddresses.getFirstAvailableWalletAddress).mockResolvedValue(WalletAddressesFixture);
            const newAddress = await getNewAddress();
            expect(newAddress).toEqual(WalletAddressesFixture.id);
        });

        it('should return false and log if an wallet address is not found', async () => {
            mocked(WalletAddresses.getFirstAvailableWalletAddress).mockResolvedValue(null);
            const newAddress = await getNewAddress();
            expect(newAddress).toBeFalsy();
            expect(consoleLogSpy).toHaveBeenCalledWith("Not able to get new address.");
        });

        it('should allow createdBySystem as an input', async () => {
            /**
             * the mocked function is used to mock the return value of the function.
             */
            mocked(WalletAddresses.getFirstAvailableWalletAddress).mockResolvedValue(WalletAddressesFixture);
            const newAddress = await getNewAddress(CreatedBySystem.UI);
            expect(newAddress).toEqual(WalletAddressesFixture.id);
        });
    });
});