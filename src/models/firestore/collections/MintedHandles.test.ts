import { MintedHandles } from "./MintedHandles";

describe('MintedHandles Tests', () => {

    it('should have the correct collection name for develop', () => {
        expect(MintedHandles.collectionName).toEqual('mintedHandles_dev');
    })
});