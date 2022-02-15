import { Firebase } from "../helpers/firebase";
import { StakePools } from "../models/firestore/collections/StakePools";

const run = async () => {
    await Firebase.init();
    const result = await StakePools.verifyReturnAddressOwnsStakePool('addr_test1qzz0sfqmvw09f6077n5z2pjekfpkpcnjny0kzdqvw3yvck7tzzszl6y8ftfm7k5u0stmy9fafqzjxekwnmmmagh5hhususp856', 'blade');
    console.log('result', result);
}

run();