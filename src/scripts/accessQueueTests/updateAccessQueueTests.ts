import * as admin from "firebase-admin";
import { VerificationInstance } from "twilio/lib/rest/verify/v2/service/verification";
import { AUTH_CODE_EXPIRE } from "../../helpers/constants";
import { Firebase } from "../../helpers/firebase";
import { AccessQueue } from "../../models/AccessQueue";
import { AccessQueues } from "../../models/firestore/collections/AccessQueues";

const fixtures = [
    new AccessQueue({ phone: '333-333-new1' }),
    new AccessQueue({ phone: '222-222-new2' }),
    new AccessQueue({ phone: '111-111-pend', status: 'pending', start: Date.now() }),
    new AccessQueue({ phone: '111-111-pend-ex', status: 'pending', start: Date.now() - AUTH_CODE_EXPIRE }),
]

const createFixturesInDatabase = async () => {
    const collectionRef = admin.firestore().collection(AccessQueues.collectionName);
    await Promise.all(fixtures.map(q => collectionRef.doc().create(q.toJSON())));
}

const createVerificationFunction = async (phone: string): Promise<VerificationInstance> => {
    if (phone === '333-333-new1') {
        // @ts-expect-error
        return {
            sid: `sid-${phone}`,
            status: 'pending',
        }
    }

    if (phone === '222-222-new2') {
        // @ts-expect-error
        return {
            sid: `sid-${phone}`,
            status: 'pending',
        }
    }

    throw new Error('phone not found');
}

/**
 * Tests should
 * 1. Only grab queues that are status "queued" and process
 * 2. check if start is expired and remove from queue
 */
const updateAccessQueueTest = async () => {
    const result = await AccessQueues.updateAccessQueue(createVerificationFunction);
    console.log('result', result);

    const accessQueues = await AccessQueues.getAccessQueues();
    console.log('accessQueues', accessQueues);

    process.exit();
}

const run = async () => {
    await Firebase.init();
    await createFixturesInDatabase();
    await updateAccessQueueTest();
}

run();