import { Firebase } from "../helpers/firebase";
import { AccessQueues } from "../models/firestore/collections/AccessQueues";

const run = async () => {
    await Firebase.init();
    const peopleInQueues = await AccessQueues.getAccessQueues();
    console.log('peopleInQueues size', peopleInQueues.length);

    const index = peopleInQueues.findIndex(p => p.email === 'some.email@test.com');

    console.log('index', index);
    console.log('time to queue', (index / 40) * 5);

    process.exit();
}

run();