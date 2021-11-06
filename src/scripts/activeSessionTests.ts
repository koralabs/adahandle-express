import { Firebase } from "../helpers/firebase";
import { ActiveSession } from "../models/ActiveSession";
import { ActiveSessions } from "../models/firestore/collections/ActiveSession";


const run = async () => {
    await Firebase.init();
    const activeSession = {
        phoneNumber: '+1',
        cost: 0,
        handle: 'xxxxxx',
        wallet: {
            address: 'addr_test1qpmahg4683csr3jfe9rxmgwre7qu73c5sededh5nl04g3durj3kgal4597evfpv5adcvdtkmu6qwqhwqtg6hsu2p7ajsn4nl5e'
        },
        start: 1234,
    }

    const addSessionResults = await Promise.all([
        ActiveSessions.addActiveSession(new ActiveSession({ ...activeSession })),
        ActiveSessions.addActiveSession(new ActiveSession({ ...activeSession, phoneNumber: '+2' })),
        ActiveSessions.addActiveSession(new ActiveSession({ ...activeSession, phoneNumber: '+3' })),
    ]);

    console.log('addSessionResults', addSessionResults);

    const sessions = await ActiveSessions.getActiveSessions();
    console.log('sessions', sessions);
    process.exit();
}


run();