import { CreatedBySystem } from '../helpers/constants';
import { Firebase } from '../helpers/firebase';
import { ActiveSession, WorkflowStatus } from '../models/ActiveSession';
import { StakePools } from '../models/firestore/collections/StakePools';

const run = async () => {
    await Firebase.init();
    const returnAddress = 'addr_test1qzz0sfqmvw09f6077n5z2pjekfpkpcnjny0kzdqvw3yvck7tzzszl6y8ftfm7k5u0stmy9fafqzjxekwnmmmagh5hhususp856'
    const returnAddressOwnsStakePool = await StakePools.verifyReturnAddressOwnsStakePool(returnAddress, 'blade');
    console.log(returnAddressOwnsStakePool);
}

run();