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
    await AccessQueues.addToQueue('333-333-3333');
    await AccessQueues.addToQueue('222-222-2222');
    await AccessQueues.addToQueue('111-111-1111');
  }

  it('should have the correct collection name for develop', () => {
    expect(AccessQueues.collectionName).toEqual('accessQueues_dev');
  });

  it('should add to queue and not have duplicates', async () => {
    await createQueues();
    await AccessQueues.addToQueue('222-222-2222');

    const accessQueues = await AccessQueues.getAccessQueues();

    expect(accessQueues).toHaveLength(3);
  });

  it('should remove queues', async () => {
    await createQueues();

    await AccessQueues.removeAccessQueueByPhone('111-111-1111');
    await AccessQueues.removeAccessQueueByPhone('222-222-2222');
    await AccessQueues.removeAccessQueueByPhone('444-444-4444');

    const accessQueues = await AccessQueues.getAccessQueues();

    expect(accessQueues).toEqual([{ "dateAdded": 1637040806003, "phone": "333-333-3333", "retries": 0, "status": "queued" }]);
  });

  describe('updateAccessQueue', () => {
    const createVerificationFunction = async (phone: string): Promise<VerificationInstance> => {
      if (phone === '333-333-3333') {
        // @ts-expect-error
        return {
          sid: `sid-${phone}`,
          status: 'pending',
        }
      }

      if (phone === '222-222-2222') {
        // @ts-expect-error
        return {
          sid: `sid-${phone}`,
          status: 'pending',
        }
      }

      throw new Error('phone not found');
    }

    it('should update the status of the queue', async () => {
      await createQueues();

      await AccessQueues.updateAccessQueue(createVerificationFunction);

      await delay(2000);

      await AccessQueues.updateAccessQueue(createVerificationFunction);

      await delay(2000);

      const accessQueuesUpdated = await AccessQueues.getAccessQueues();

      const queued = accessQueuesUpdated.find(q => q.phone === '111-111-1111');
      expect(queued).toEqual({ "dateAdded": expect.any(Number), "phone": "111-111-1111", "attempts": 2, "status": "queued" });

      const pending222 = accessQueuesUpdated.find(q => q.phone === '222-222-2222');
      expect(pending222).toEqual({ "dateAdded": expect.any(Number), "phone": "222-222-2222", "attempts": 0, "sid": "sid-222-222-2222", "start": expect.any(Number), "status": "pending" });

      const pending333 = accessQueuesUpdated.find(q => q.phone === '333-333-3333');
      expect(pending333).toEqual({ "dateAdded": expect.any(Number), "phone": "333-333-3333", "attempts": 0, "sid": "sid-333-333-3333", "start": expect.any(Number), "status": "pending" });
    }, 20000);
  });
});