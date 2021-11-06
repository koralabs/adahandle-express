import { Firebase } from "../helpers/firebase";
import { ActiveSession } from "../models/ActiveSession";
import { State } from "../models/State";
import { ActiveSessions } from "../models/firestore/collections/ActiveSession";
import { StateData } from "../models/firestore/collections/StateData";


const run = async () => {
    await Firebase.init();

    const state = new State({ chainLoad: 1, position: 2, totalHandles: 3 });
    await StateData.upsertStateData(state);

    const stateData = await StateData.getStateData();
    console.log('stateData', stateData);
    process.exit();
}

run();