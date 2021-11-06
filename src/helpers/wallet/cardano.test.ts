import { getWalletServer } from './cardano';

describe('Wallet Tests', () => {
    it('Should get wallet server', async () => {
        const server = getWalletServer();
        expect(server).toHaveProperty('getShelleyWallet');
        expect(server).toHaveProperty('getNetworkInformation');
    });
});