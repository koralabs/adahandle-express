import { Firebase } from "../helpers/firebase";
import { PaidSessions } from "../models/firestore/collections/PaidSessions";


const run = async () => {
    await Firebase.init();

    // const paidSessions = await PaidSessions.getByStatus({ statusType: "submitted", limit: 15000 });
    const paidSessions = await PaidSessions.getPaidSessionsUnsafe();

    console.log('paidSessions size', paidSessions.length);

    let total = 0;
    const costsMap: Record<number, number> = {};
    for (let i = 0; i < paidSessions.length; i++) {
        const paidSession = paidSessions[i];

        const currentCost = costsMap[paidSession.cost];
        if (currentCost) {
            costsMap[paidSession.cost] = currentCost + 1;
        } else {
            costsMap[paidSession.cost] = 1;
        }

        // grab the total cost
        total += paidSession.cost;
    }

    const newMap: Record<string, { total: number, percentage: number }> = {};
    Object.keys(costsMap).forEach(key => {
        const currentCost = costsMap[key];
        const percentage = (currentCost / paidSessions.length) * 100;
        newMap[key] = { total: currentCost, percentage };
    });

    console.log('ADA', total);
    console.log('costsMap', costsMap);
    console.log('newMap', newMap);

    process.exit();
}

run();