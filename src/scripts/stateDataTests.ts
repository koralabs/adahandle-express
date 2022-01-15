import { Firebase } from "../helpers/firebase";
import { State } from "../models/State";
import { CronJobLockName, StateData } from "../models/firestore/collections/StateData";
import { delay } from "../helpers/utils";


const run = async () => {
    await Firebase.init();

    await StateData.lockCron(CronJobLockName.UPDATE_ACTIVE_SESSIONS_LOCK);

    await delay(2000);

    const state = new State({ chainLoad: 1, accessQueueSize: 2, mintingQueueSize: 2, totalHandles: 3 });
    await StateData.upsertStateData(state);

    const stateData = await StateData.getStateData();

    // State data should not update locks or limits
    console.log('stateData', stateData);
    process.exit();
}

run();