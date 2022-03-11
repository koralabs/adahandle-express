import { Firebase } from "../../helpers/firebase";
import { asyncForEach } from "../../helpers/utils";
import { AccessQueues } from "../../models/firestore/collections/AccessQueues";

export const addToQueue = async () => {
    let index = 0;
    const emails = Array.from({ length: 10000 }, () => {
        index++;
        return `${index}@adahandle.io`;
    });

    await asyncForEach(emails, async (email) => {
        console.log(email);
        await AccessQueues.addToQueue({ email, clientAgentSha: `sha${email}`, clientIp: `ip${email}` });
    });

    return emails.length;
};

const clearTheQueueOfTests = async () => {
    const accesses = (await AccessQueues.getAccessQueues()).filter(access => access.email.endsWith('@adahandle.io'));
    await asyncForEach(accesses, async (access) => {
        console.log(`Removing ${access.email}`);
        await AccessQueues.removeAccessQueueByEmail(access.email);
    }, 1);
}

const run = async () => {
    await Firebase.init();
    console.log(`starting`);
    await addToQueue();
    //await clearTheQueueOfTests();
    console.log('done');
    process.exit();
}

run();