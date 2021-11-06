import { WalletAddresses } from "./WalletAddresses";

describe('WalletAddresses Tests', () => {
    it('should have the correct collection name for develop', () => {
        expect(WalletAddresses.collectionName).toEqual('walletAddresses_dev');
    })
});