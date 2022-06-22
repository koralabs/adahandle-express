import { writeFile } from 'fs';
import { Firebase } from '../helpers/firebase';
import { awaitForEach } from '../helpers/utils';
import { StakePools } from '../models/firestore/collections/StakePools';
import { ReservedHandles } from '../models/firestore/collections/ReservedHandles';
import { StakePool } from '../models/StakePool';
import { ActiveSessions } from '../models/firestore/collections/ActiveSession';
import { CreatedBySystem } from '../helpers/constants';
import { ActiveSession } from '../models/ActiveSession';

const run = async () => {
    await Firebase.init();
    // get all the spos from the snapshot
    const docs = await StakePools.getAllStakePools(0);
    const stakePools = docs.map((doc) => doc.data() as StakePool);

    // remove pools that are expired
    const filteredSpos = stakePools.filter((pool) => !pool.isRetired);

    let csvBuilder = 'HandleName,Available,Cost,In Reserved SPO,Reason,CBS,Date Created,Pool Creation Date\n';

    // sort filteredSpos by ticker
    filteredSpos.sort((a, b) => a.ticker.localeCompare(b.ticker));

    // check availablity of each spo
    const length = filteredSpos.length;
    await awaitForEach(filteredSpos, async (pool, i) => {
        const handle = pool.ticker.toLocaleLowerCase();

        const response = await ReservedHandles.checkAvailability(handle);
        const sessions = await ActiveSessions.getByHandle(handle);

        if (response.available) {
            csvBuilder += `${handle},Yes,${pool.isOG ? 2 : 250},No,,,,\n`;
        } else {
            if (response.type === 'spo') {
                csvBuilder += `${handle},Yes,${pool.isOG ? 2 : 250},Yes,,,,\n`;
            } else {
                let createdBySystem = '';
                let dateCreated = '';
                if (sessions.length > 0) {
                    createdBySystem = sessions[0].createdBySystem ?? '';
                    dateCreated = sessions[0].dateAdded ? new Date(sessions[0].dateAdded).toISOString() : '';
                    console.log(`created on date: ${dateCreated}`);
                }

                csvBuilder += `${handle},No,,No,${response.type},${createdBySystem},${dateCreated},${new Date(
                    pool.oldestTxIncludedAt ?? 0
                ).toISOString()}\n`;
            }
        }

        console.log(`${i}/${length}`);
    });

    // add to large csv file
    console.log(csvBuilder);
    writeFile('spos.csv', csvBuilder, (err: any) => {
        if (err) {
            console.log(err);
        }

        console.log('The file was saved!');
        process.exit();
    });
};

run();
