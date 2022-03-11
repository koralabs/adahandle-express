import { Firebase } from "../../helpers/firebase";
import { AccessQueues } from "../../models/firestore/collections/AccessQueues";
import { VerificationInstance } from "../../helpers/email";

export const updateAccessQueueTest = async () => {
    let index = 0;
    const promises = Array.from({ length: 1 }, () => {
        return AccessQueues.updateAccessQueue(async (email) => {return {authCode: "123", status:"OK"} as VerificationInstance;}).then((data) => {
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
    const count = await AccessQueues.getAccessQueueCount();
    console.timeEnd("updateAccessQueueTest");
    console.log(`count: ${count}`);
}

run();
