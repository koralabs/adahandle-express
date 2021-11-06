import { ActiveSessions } from "./ActiveSession";

describe('ActiveSession Tests', () => {
  it('should have the correct collection name for develop', () => {
    expect(ActiveSessions.collectionName).toEqual('activeSessions_dev');
  })
});