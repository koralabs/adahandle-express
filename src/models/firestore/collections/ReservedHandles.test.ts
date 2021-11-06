import { ReservedHandles } from "./ReservedHandles";

describe('ReservedHandles Tests', () => {
    it('should have the same collection name for develop and production', () => {
        expect(ReservedHandles.collectionName).toEqual('reservedHandles');
    })
});