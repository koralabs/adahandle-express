import { Firebase } from "../../helpers/firebase";
import { AccessQueues } from "../../models/firestore/collections/AccessQueues";

const checkQueues = async () => {
    const [position, position2, position3, position2Duplicate] = await Promise.all([
        AccessQueues.addToQueue('333-333-3333'),
        AccessQueues.addToQueue('222-222-2222'),
        AccessQueues.addToQueue('111-111-1111'),
        AccessQueues.addToQueue('222-222-2222')
    ]);


    console.log('position', position); // position should be 1
    console.log('position2', position2); // position should be 2
    console.log('position3', position3); // position should be 3
    console.log('position2Duplicate', position2Duplicate); // should be existing and be position 2

    const accessQueues = await AccessQueues.getAccessQueues();
    console.log('accessQueues', accessQueues);

    const [positionRemoved, position2Removed, notRemoved] = await Promise.all([
        AccessQueues.removeAccessQueueByPhone('111-111-1111'),
        AccessQueues.removeAccessQueueByPhone('222-222-2222'),
        AccessQueues.removeAccessQueueByPhone('444-444-4444'), // Doesn't exist, should not remove anything
    ]);

    console.log('positionRemoved, position2Removed, notRemoved', positionRemoved, position2Removed, notRemoved);

    const remainingAccessQueues = await AccessQueues.getAccessQueues();
    console.log('remainingAccessQueues', remainingAccessQueues); // should only have position 3

    process.exit();
}


const run = async () => {
    await Firebase.init();
    await checkQueues();
}


run();
