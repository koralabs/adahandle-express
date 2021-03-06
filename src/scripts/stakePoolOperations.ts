import { Firebase } from '../helpers/firebase';
import { StakePools } from '../models/firestore/collections/StakePools';
import { StakePool } from '../models/StakePool';
import { readFixturesFile } from './helpers/readFixtureFile';
import { batchUpdate } from './helpers/batchUpdate';
import { fetchPoolDetails } from '../helpers/blockfrost';
import { getStakePoolsById, getTransactionsByHashes } from '../helpers/graphql';

import * as admin from 'firebase-admin';
import { ReservedHandles } from '../models/firestore/collections/ReservedHandles';
import { asyncForEach, awaitForEach, chunk } from '../helpers/utils';

const getDuplicateTickers = async () => {
    const stakePools = await StakePools.getAllStakePools(0);

    const activeTickers = stakePools.filter((pool) => !pool.data().isRetired);

    const poolTickers = activeTickers.map((pool) => pool.data().ticker);

    console.log('poolTickers length', poolTickers.length);

    const tickerMap = new Map<string, { name: string; amount: number }>();
    poolTickers.forEach((ticker) => {
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
    return tickers;
};

const updateOGs = async () => {
    const ogPools = await readFixturesFile<string[]>('./src/scripts/fixtures/stakePools/og.json');
    console.log(ogPools);

    const stakePools = await StakePools.getAllStakePools(0);

    await batchUpdate(stakePools, async (doc) => {
        const pool = doc.data() as StakePool;
        const isOG = ogPools.some((ticker) => ticker === pool.ticker);
        console.log(`${pool.ticker} is ${isOG ? 'OG' : 'NOT OG'}`);
        return {
            isOG
        };
    });
};

const updatePoolDetails = async (
    stakePools: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>[]
) => {
    const filteredStakePools = stakePools.filter((pool) => {
        const data = pool.data() as StakePool;
        return !data.vrfKeyHash;
    });

    console.log('filteredStakePools length', filteredStakePools.length);

    await batchUpdate(
        filteredStakePools,
        async (doc) => {
            const pool = doc.data() as StakePool;
            const details = await fetchPoolDetails(pool.id);

            if (details.error) {
                return {
                    error: details.error,
                    hasError: true
                };
            }

            const { vrf_key, registration = [], retirement = [] } = details;

            return {
                vrfKeyHash: vrf_key,
                registration: registration,
                retirement: retirement,
                isRetired: retirement.length > 0,
                hasError: false,
                error: ''
            };
        },
        200
    );
};

const updateOldestSPODate = async () => {
    const stakePools = await StakePools.getAllStakePools(0);

    console.log('stakePools length', stakePools.length);

    // update records with oldest date from the registered hashes
    await batchUpdate(
        stakePools,
        async (doc) => {
            const pool = doc.data() as StakePool;
            if (!pool.registration) {
                return {
                    oldestTxIncludedAt: 0
                };
            }

            const details = await getTransactionsByHashes(pool.registration);

            const includedAtDates = details.map((tx) => new Date(tx.includedAt));

            if (includedAtDates.length === 0) {
                return {
                    oldestTxIncludedAt: 0
                };
            }

            // order dates by oldest to newest
            includedAtDates.sort((a, b) => a.getTime() - b.getTime());

            const [oldestDate] = includedAtDates;

            return {
                oldestTxIncludedAt: oldestDate.getTime()
            };
        },
        200
    );
};

const addPoolTicker = async (id: string, ticker: string, isOG = false) => {
    // get pool on chain
    const pools = await getStakePoolsById([id]);

    if (!pools || !pools.length) {
        console.log('No pool found for id', id);
        process.exit();
    }

    const [pool] = pools;

    // save stake pool
    const newPool = new StakePool({
        id,
        ticker,
        stakeKey: pool.rewardAddress,
        ownerHashes: pool.owners.map((owner) => owner.hash),
        isOG
    });
    await StakePools.addStakePool(newPool);

    // save details from blockfrost
    const details = await fetchPoolDetails(id);
    if (details.error) {
        throw new Error('Error fetching pool details');
    }

    const { vrf_key, registration = [], retirement = [] } = details;

    const updateParams = {
        vrfKeyHash: vrf_key,
        registration,
        retirement,
        isRetired: retirement.length > 0,
        hasError: false,
        error: ''
    };

    await StakePools.updateStakePool(id, updateParams);

    // update registration oldest date
    if (!registration) {
        await StakePools.updateStakePool(id, {
            oldestTxIncludedAt: 0
        });
    }

    const hashes = await getTransactionsByHashes(registration);

    const includedAtDates = hashes.map((tx) => new Date(tx.includedAt));

    if (includedAtDates.length === 0) {
        await StakePools.updateStakePool(id, {
            oldestTxIncludedAt: 0
        });
    }

    // order dates by oldest to newest
    includedAtDates.sort((a, b) => a.getTime() - b.getTime());

    const [oldestDate] = includedAtDates;

    await StakePools.updateStakePool(id, {
        oldestTxIncludedAt: oldestDate.getTime()
    });
};

const intersectReservedWithPools = async () => {
    const records = await admin.firestore().collection(ReservedHandles.collectionSPOs).get();
    const stakePools = await admin.firestore().collection(StakePools.collectionName).get();

    const poolTickers = stakePools.docs.map((doc) => doc.data() as StakePool).map((pool) => pool.ticker);

    const reservedNotInPools = records.docs.reduce<string[]>((agg, doc) => {
        const docId = doc.id;
        if (!poolTickers.includes(docId)) {
            agg.push(docId);
        }
        return agg;
    }, []);

    console.log(JSON.stringify(reservedNotInPools));
};

const verifyRetired = async () => {
    const stakePools = await StakePools.getAllStakePools(0);
    const pools = stakePools.map((pool) => pool.data() as StakePool);

    console.log('pools length', pools.length);

    const poolsChunks = chunk(pools, 20);

    const retiredPools: string[] = [];

    await awaitForEach(poolsChunks, async (poolChunk, index) => {
        await asyncForEach(poolChunk, async (pool) => {
            // get the date of retirement
            const registrationTransactions = await getTransactionsByHashes(pool.registration ?? []);
            const registrationDates = registrationTransactions.map((tx) => new Date(tx.includedAt));
            registrationDates.sort((a, b) => b.getTime() - a.getTime());
            const [newestRegistration] = registrationDates;

            // get the last date of registration
            const retirementTransactions = await getTransactionsByHashes(pool.retirement ?? []);
            const retirementDates = retirementTransactions.map((tx) => new Date(tx.includedAt));
            retirementDates.sort((a, b) => b.getTime() - a.getTime());
            const [newestRetirement] = retirementDates;

            // check if registration is newer
            if (newestRegistration > newestRetirement) {
                retiredPools.push(pool.ticker);
            }
        });

        console.log(`completed chunk ${index} of ${poolsChunks.length}`);
    });

    console.log('retiredPools', retiredPools);
};

// GRAPHQL_ENDPOINT=http://graphql.testnet.adahandle.io:3100 BLOCKFROST_API_KEY=testnetXbmgIyDcm8QonJyY0uxTbpxvUqOYv8nH ts-node -r dotenv/config ./src/scripts/stakePoolOperations.ts
const run = async () => {
    try {
        await Firebase.init();
        await verifyRetired();
    } catch (error) {
        console.log('ERROR', error);
        process.exit(1);
    }

    process.exit();
};

run();
