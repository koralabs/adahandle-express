import { AccessQueues } from "./AccessQueues";

describe('AccessQueues Tests', () => {
  it('should have the correct collection name for develop', () => {
    expect(AccessQueues.collectionName).toEqual('accessQueues_dev');
  })
});