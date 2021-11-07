import { appendAccessQueueData, Firebase } from "../../helpers/firebase";

export const appendAccessQueueDataToFirestore = async () => {
    let index = 0;
    const promises = Array.from({ length: 700 }, () => {
        const random = Math.random().toString().slice(2, 11);
        try {
            return appendAccessQueueData(random).then((data) => {
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
    await appendAccessQueueDataToFirestore();
}

run();
