import { Firebase } from '../helpers/firebase';
import { StakePools } from '../models/firestore/collections/StakePools';
import { StakePool } from '../models/StakePool';
import { readFixturesFile } from './helpers/readFixtureFile';
import { batchUpdate } from './helpers/batchUpdate';

const run = async () => {
    try {
        await Firebase.init();
        const ogPools = await readFixturesFile<string[]>('./src/scripts/fixtures/stakePools/og.json');
        console.log(ogPools);

        const stakePools = await StakePools.getAllStakePools(1);

        await batchUpdate(stakePools, async (doc) => {
            const pool = doc.data() as StakePool;
            const isOG = ogPools.some(ticker => ticker === pool.ticker);
            console.log(`${pool.ticker} is ${isOG ? 'OG' : 'NOT OG'}`);
            return {
                isOG
            }
        });

    } catch (error) {
        console.log('ERROR', error);
        process.exit(1);
    }

    process.exit();
}

run();
