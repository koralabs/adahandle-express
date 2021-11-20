import { appendAccessQueueData, Firebase } from "../../helpers/firebase";
import { AccessQueues } from "../../models/firestore/collections/AccessQueues";

export const appendAccessQueueDataToFirestore = async () => {
    let index = 0;
    const promises = Array.from({ length: 10000 }, () => {
        const random = Math.random().toString().slice(2, 11);
        try {
            return appendAccessQueueData({ email: random, clientAgentSha: 'sha', clientIp: 'ip' }).then((data) => {
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
};

const run = async () => {
    await Firebase.init();
    console.log(`starting`);
    console.time("appendAccessQueueDataToFirestore");
    const count = await AccessQueues.getAccessQueuesCount();
    console.timeEnd("appendAccessQueueDataToFirestore");
    console.log(`count: ${count}`);

}

run();
