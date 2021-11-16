import * as admin from "firebase-admin";
import { AccessQueues } from "./AccessQueues";

describe('AccessQueues Tests', () => {
  let app: admin.app.App;

  beforeEach(() => {
    app = admin.initializeApp({
      projectId: "mock-project-id",
    });

    const db = admin.firestore();
    db.settings({
      host: "localhost:8080",
      ssl: false
    });
  });

  afterEach(() => {
    app.delete();
  });

  it('should have the correct collection name for develop', () => {
    expect(AccessQueues.collectionName).toEqual('accessQueues_dev');
  });

  const createQueues = async () => {
    await AccessQueues.addToQueue('333-333-3333');
    await AccessQueues.addToQueue('222-222-2222');
    await AccessQueues.addToQueue('111-111-1111');
  }

  it('should add to queue and not have duplicates', async () => {
    await createQueues();
    await AccessQueues.addToQueue('222-222-2222');

    const accessQueues = await AccessQueues.getAccessQueues();

    expect(accessQueues).toEqual([
      { "dateAdded": expect.any(Number), "phone": "333-333-3333", "retries": 0, "status": "queued" },
      { "dateAdded": expect.any(Number), "phone": "222-222-2222", "retries": 0, "status": "queued" },
      { "dateAdded": expect.any(Number), "phone": "111-111-1111", "retries": 0, "status": "queued" }
    ]);
  });

  it('should remove queues', async () => {
    await createQueues();

    await AccessQueues.removeAccessQueueByPhone('111-111-1111');
    await AccessQueues.removeAccessQueueByPhone('222-222-2222');
    await AccessQueues.removeAccessQueueByPhone('444-444-4444');

    const accessQueues = await AccessQueues.getAccessQueues();

    expect(accessQueues).toEqual([{ "dateAdded": 1637040806003, "phone": "333-333-3333", "retries": 0, "status": "queued" }]);
  });

  // it('should add to queue and remove', async () => {
  //   const [position, position2, position3, position2Duplicate] = await Promise.all([
  //     AccessQueues.addToQueue('333-333-3333'),
  //     AccessQueues.addToQueue('222-222-2222'),
  //     AccessQueues.addToQueue('111-111-1111'),
  //     AccessQueues.addToQueue('222-222-2222')
  //   ]);


  //   console.log('position', position); // position should be 1
  //   console.log('position2', position2); // position should be 2
  //   console.log('position3', position3); // position should be 3
  //   console.log('position2Duplicate', position2Duplicate); // should be existing and be position 2

  //   const accessQueues = await AccessQueues.getAccessQueues();
  //   console.log('accessQueues', accessQueues);

  //   const [positionRemoved, position2Removed, notRemoved] = await Promise.all([
  //     AccessQueues.removeAccessQueueByPhone('111-111-1111'),
  //     AccessQueues.removeAccessQueueByPhone('222-222-2222'),
  //     AccessQueues.removeAccessQueueByPhone('444-444-4444'), // Doesn't exist, should not remove anything
  //   ]);

  //   console.log('positionRemoved, position2Removed, notRemoved', positionRemoved, position2Removed, notRemoved);

  //   const remainingAccessQueues = await AccessQueues.getAccessQueues();
  //   expect(remainingAccessQueues).toEqual(null);
  // });
});