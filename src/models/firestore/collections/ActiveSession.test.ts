import * as admin from "firebase-admin";
import { ActiveSession } from "../../ActiveSession";

import { ActiveSessions } from "./ActiveSession";
import { cleanupTesting, initTesting } from "./lib/testBase";

describe('ActiveSessions Tests', () => {
  let app: admin.app.App;
  let db: admin.firestore.Firestore;

  beforeEach(async () => {
    ({ app, db } = initTesting());
  });

  afterEach(async () => {
    await cleanupTesting(db, app, { collections: [ActiveSessions.collectionName] });
  });

  it('should have the correct collection name for develop', () => {
    expect(ActiveSessions.collectionName).toEqual('activeSessions_dev');
  });

  it('should remove active sessions', async () => {
    const activeSessions = [
      new ActiveSession({ emailAddress: '111-111-1111', cost: 20, handle: 'tacos', paymentAddress: 'test_addr1', start: Date.now() }),
      new ActiveSession({ emailAddress: '222-222-2222', cost: 20, handle: 'tacos', paymentAddress: 'test_addr2', start: Date.now() }),
      new ActiveSession({ emailAddress: '333-333-3333', cost: 20, handle: 'tacos', paymentAddress: 'test_addr3', start: Date.now() })
    ];

    await ActiveSessions.addActiveSessions(activeSessions);

    const sessions = await ActiveSessions.getActiveSessions();
    sessions.sort((a, b) => a.emailAddress.localeCompare(b.emailAddress));

    await ActiveSessions.removeActiveSessions([sessions[0], sessions[1]]);

    const sessionsAfterRemove = await ActiveSessions.getActiveSessions();
    expect(sessionsAfterRemove).toEqual([{ ...sessions[2], id: expect.any(String), start: expect.any(Number) }]);
  });
});
