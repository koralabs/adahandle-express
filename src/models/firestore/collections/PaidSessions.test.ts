import { PaidSessions } from "./PaidSessions";

describe('PaidSessions Tests', () => {
    it('should have the correct collection name for develop', () => {
        expect(PaidSessions.collectionName).toEqual('paidSessions_dev');
    })
});