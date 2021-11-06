import { RefundableSessions } from "./RefundableSessions";

describe('RefundableSessions Tests', () => {
    it('should have the correct collection name for develop', () => {
        expect(RefundableSessions.collectionName).toEqual('refundableSessions_dev');
    })
});