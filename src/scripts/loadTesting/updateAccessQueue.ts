import { Firebase } from "../../helpers/firebase";
import { AccessQueues } from "../../models/firestore/collections/AccessQueues";
import { appendAccessQueueDataToFirestore } from "./appendAccessQueueData";

export const updateAccessQueueTest = async () => {
    let index = 0;
    const promises = Array.from({ length: 1 }, () => {
        try {
            return AccessQueues.updateAccessQueue().then((data) => {
                index++;
                console.log(`data at index ${index}`, data);
                return data;
            });
        } catch (error) {
            console.log(error);
            return Promise.resolve({});
        }
    });

    await Promise.allSettled(promises);
}

const run = async () => {
    await Firebase.init();
    //await appendAccessQueueDataToFirestore();
    await updateAccessQueueTest();
}

run();
