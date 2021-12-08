import * as admin from "firebase-admin";
import { VerificationInstance } from "twilio/lib/rest/verify/v2/service/verification";
import { delay } from "../../../helpers/utils";
import { State } from "../../State";
import { AccessQueues } from "./AccessQueues";
import { StateData } from "./StateData";

describe('AccessQueues Tests', () => {
  let app: admin.app.App;

  beforeEach(async () => {
    app = admin.initializeApp({
      projectId: "ada-handle-reserve",
    });

    const db = admin.firestore();
    db.settings({
      host: "localhost:8080",
      ssl: false
    });

    await admin.firestore().collection(StateData.collectionName).doc(StateData.docName).set(new State({ chainLoad: 1, position: 2, totalHandles: 3, updateActiveSessions_lock: false, accessQueue_limit: 20 }).toJSON());
  });

  afterEach(async () => {
    await app.delete();
  });

  const createQueues = async () => {
    await AccessQueues.addToQueue({ email: '333-333-3333', clientAgentSha: 'abc123', clientIp: '123' });
    await AccessQueues.addToQueue({ email: '222-222-2222', clientAgentSha: 'abc123', clientIp: '123' });
    await AccessQueues.addToQueue({ email: '111-111-1111', clientAgentSha: 'abc123', clientIp: '123' });
  }

  it('should have the correct collection name for develop', () => {
    expect(AccessQueues.collectionName).toEqual('accessQueues_dev');
  });

  it('should add to queue and not have duplicates', async () => {
    await createQueues();
    await AccessQueues.addToQueue({ email: '222-222-2222', clientAgentSha: 'abc123', clientIp: '123' });

    const accessQueues = await AccessQueues.getAccessQueues();

    expect(accessQueues).toHaveLength(3);
  });

  it('should remove queues', async () => {
    await createQueues();

    await AccessQueues.removeAccessQueueByEmail('111-111-1111');
    await AccessQueues.removeAccessQueueByEmail('222-222-2222');
    await AccessQueues.removeAccessQueueByEmail('444-444-4444');

    const accessQueues = await AccessQueues.getAccessQueues();

    expect(accessQueues).toEqual([{ "dateAdded": 1637040806003, "email": "333-333-3333", "retries": 0, "status": "queued" }]);
  });

  describe('updateAccessQueue', () => {
    const createVerificationFunction = async (email: string): Promise<VerificationInstance> => {
      if (email === '333-333-3333') {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        return {
          sid: `sid-${email}`,
          status: 'pending',
        }
      }

      if (email === '222-222-2222') {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        return {
          sid: `sid-${email}`,
          status: 'pending',
        }
      }

      throw new Error('email not found');
    }

    it('should update the status of the queue', async () => {
      await createQueues();

      await AccessQueues.updateAccessQueue(createVerificationFunction);

      await delay(2000);

      await AccessQueues.updateAccessQueue(createVerificationFunction);

      await delay(2000);

      const accessQueuesUpdated = await AccessQueues.getAccessQueues();

      const queued = accessQueuesUpdated.find(q => q.email === '111-111-1111');
      expect(queued).toEqual({ "dateAdded": expect.any(Number), "email": "111-111-1111", "attempts": 2, "status": "queued" });

      const pending222 = accessQueuesUpdated.find(q => q.email === '222-222-2222');
      expect(pending222).toEqual({ "dateAdded": expect.any(Number), "email": "222-222-2222", "attempts": 0, "sid": "sid-222-222-2222", "start": expect.any(Number), "status": "pending" });

      const pending333 = accessQueuesUpdated.find(q => q.email === '333-333-3333');
      expect(pending333).toEqual({ "dateAdded": expect.any(Number), "email": "333-333-3333", "attempts": 0, "sid": "sid-333-333-3333", "start": expect.any(Number), "status": "pending" });
    }, 20000);
  });
});
