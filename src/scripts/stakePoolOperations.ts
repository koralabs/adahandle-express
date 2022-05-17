import { Firebase } from '../helpers/firebase';
import { StakePools } from '../models/firestore/collections/StakePools';
import { StakePool } from '../models/StakePool';
import { readFixturesFile } from './helpers/readFixtureFile';
import { batchUpdate } from './helpers/batchUpdate';
import { fetchPoolDetails } from '../helpers/blockfrost';

const getDuplicateTickers = async () => {
    const stakePools = await StakePools.getAllStakePools(0);

    const activeTickers = stakePools.filter(pool => !pool.data().isRetired);

    const poolTickers = activeTickers.map(pool => pool.data().ticker);

    console.log('poolTickers length', poolTickers.length);

    const tickerMap = new Map<string, { name: string; amount: number }>();
    poolTickers.forEach(ticker => {
        const item = tickerMap.get(ticker);
        if (!item) {
            tickerMap.set(ticker, { name: ticker, amount: 1 });
        } else {
            item.amount++;
            tickerMap.set(ticker, item);
        }
    });

    const tickers = [...tickerMap.values()];
    // order tickers by amount
    tickers.sort((a, b) => b.amount - a.amount);

    console.log('duplicates', JSON.stringify(tickers));
}

const updateOGs = async () => {
    const ogPools = await readFixturesFile<string[]>('./src/scripts/fixtures/stakePools/og.json');
    console.log(ogPools);

    const stakePools = await StakePools.getAllStakePools(0);

    await batchUpdate(stakePools, async (doc) => {
        const pool = doc.data() as StakePool;
        const isOG = ogPools.some(ticker => ticker === pool.ticker);
        console.log(`${pool.ticker} is ${isOG ? 'OG' : 'NOT OG'}`);
        return {
            isOG
        }
    });
}

const updatePoolDetails = async () => {
    const stakePools = await StakePools.getAllStakePools(0);

    console.log('stakePools length', stakePools.length);

    const filteredStakePools = stakePools.filter(pool => {
        const data = pool.data() as StakePool;
        return !data.vrfKeyHash;
    });

    console.log('filteredStakePools length', filteredStakePools.length);

    // return;

    await batchUpdate(filteredStakePools, async (doc) => {
        const pool = doc.data() as StakePool;
        const details = await fetchPoolDetails(pool.id);

        if (details.error) {
            return {
                error: details.error,
                hasError: true
            }
        }

        const { vrf_key, registration = [], retirement = [] } = details;

        return {
            vrfKeyHash: vrf_key,
            registration: registration,
            retirement: retirement,
            isRetired: retirement.length > 0,
            hasError: false,
            error: ''
        }
    }, 200);
}

const run = async () => {
    try {
        await Firebase.init();
        await getDuplicateTickers();
    } catch (error) {
        console.log('ERROR', error);
        process.exit(1);
    }

    process.exit();
}

run();
