import { Firebase } from "../../helpers/firebase";
import { AccessQueues } from "../../models/firestore/collections/AccessQueues";
import { appendAccessQueueDataToFirestore } from "./appendAccessQueueData";
import { VerificationInstance } from "twilio/lib/rest/verify/v2/service/verification";

export const updateAccessQueueTest = async () => {
    let index = 0;
    const promises = Array.from({ length: 1 }, () => {
        return AccessQueues.updateAccessQueue(async (email) => {return {sid: "123", status:"OK"} as VerificationInstance;}).then((data) => {
            index++;
            console.log(`data at index ${index}`, data);
            return data;
        }).catch((error) => {
            console.log(error);
            return Promise.resolve({});
        });
    });

    await Promise.allSettled(promises);
}

const run = async () => {
    await Firebase.init();
    console.log(`starting`);
    console.time("updateAccessQueueTest");
    //await appendAccessQueueDataToFirestore();
    //await updateAccessQueueTest();
    const count = await AccessQueues.getAccessQueuesCount();
    console.timeEnd("updateAccessQueueTest");
    console.log(`count: ${count}`);
}

run();
