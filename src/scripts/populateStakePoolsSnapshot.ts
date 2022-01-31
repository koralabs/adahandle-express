import axios from 'axios';
import { readFileSync } from 'fs';
import { Firebase } from '../helpers/firebase';
import { StakePoolDetails } from '../helpers/graphql';
import { awaitForEach, chunk } from '../helpers/utils';
import { StakePools } from '../models/firestore/collections/StakePools';
import { StakePool } from '../models/StakePool';

interface MetaData {
    name: string,
    description: string,
    ticker: string,
    homepage: string
}

const getStakePoolsFromJSONFile = async () => {
    const file = readFileSync('./src/scripts/fixtures/stakePools/testnet-stake-pools.json', 'utf8');
    const json = JSON.parse(file);
    console.log(`current address length: ${json.data.stakePools.length}`);
    return json.data.stakePools;
}

const getPoolsToAdd = async (): Promise<StakePool[]> => {
    const stakePools = await getStakePoolsFromJSONFile() as StakePoolDetails[];
    console.log('stakePools', stakePools.length);

    const filteredStakePools = stakePools.filter(stakePool => stakePool.url);
    console.log('filteredStakePools', filteredStakePools.length);

    const chunkedFilteredStakePools = chunk(filteredStakePools, 100);

    const stakePoolsToAdd = [] as StakePool[];
    await awaitForEach(chunkedFilteredStakePools, async (stakePools) => {
        const tickerPromises = stakePools.map<Promise<StakePool | null>>(stakePool => {
            return axios.get<MetaData>(stakePool.url).catch(err => null).then(req => {
                if (req?.status !== 200) {
                    return null;
                }

                const { data: { ticker } } = req;
                if (!ticker) {
                    return null;
                }

                console.log(`${stakePool.url} ${ticker}`);

                return new StakePool(stakePool.id, ticker, stakePool.rewardAddress, stakePool.owners.map(owner => owner.hash));
            });
        });

        const stakePoolsWithTickers = await Promise.all(tickerPromises);
        const poolsWithTicker = stakePoolsWithTickers.filter(Boolean) as StakePool[];
        console.log(poolsWithTicker);
        stakePoolsToAdd.push(...poolsWithTicker);
    });

    return stakePoolsToAdd
}

const run = async () => {
    await Firebase.init();

    const stakePoolsToAdd = await getPoolsToAdd();
    console.log(`Saving ${stakePoolsToAdd.length} stake pools to the DB`);

    await StakePools.batchAddStakePools(stakePoolsToAdd);
}

run();