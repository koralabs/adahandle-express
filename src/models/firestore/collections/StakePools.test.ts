import { StakePools } from "./StakePools";

describe('StakePools Tests', () => {
    it('Should have the correct collection name for develop', () => {
        expect(StakePools.collectionName).toEqual('stakePools_dev');
    })
});