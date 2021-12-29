import * as admin from "firebase-admin";

import { Firebase } from "../helpers/firebase";
import { LogCategory, Logger } from "../helpers/Logger";

interface ClientAgentSession {
    clientAgentSha: string,
    clientIp: string,
    dateAdded: number,
    id: string
}

interface ClientAgentInfo {
    occurrences: number,
    ips: string[],
    id: string
}

const COLLECTION_NAME_CLIENT_AGENT_SESSIONS = 'clientAgentSessions';
const COLLECTION_NAME_CLIENT_AGENT_INFO = 'clientAgentInfo';

const getClientAgentSessions = async (): Promise<ClientAgentSession[]> => {
    const collection = await admin.firestore().collection(COLLECTION_NAME_CLIENT_AGENT_SESSIONS).get();
    return collection.docs.map(doc => ({ ...doc.data(), id: doc.id } as ClientAgentSession));
}

const getClientAgentInfo = async (): Promise<ClientAgentInfo[]> => {
    const collection = await admin.firestore().collection(COLLECTION_NAME_CLIENT_AGENT_INFO).where('occurrences', '>=', 5).get();
    return collection.docs.map(doc => ({ ...doc.data(), id: doc.id } as ClientAgentInfo));
}

const removeClientAgentSessions = async (clientSessions: ClientAgentSession[]): Promise<void> => {
    await Promise.all(clientSessions.map(async session => {
        return admin.firestore().runTransaction(async t => {
            const docRef = admin.firestore().collection(COLLECTION_NAME_CLIENT_AGENT_SESSIONS).doc(session.id as string);
            t.delete(docRef);
        }).catch(error => {
            Logger.log({ message: `error: ${JSON.stringify(error)} removing ${session.id}`, event: 'clientAgentSessions.error', category: LogCategory.ERROR });
        });
    }));
}


const run = async () => {
    await Firebase.init();

    const clientAgentInfos = await getClientAgentInfo();
    const filteredClientAgentInfos = clientAgentInfos.filter(info => info.ips.length === 1);
    console.log('filteredClientAgentInfos size', filteredClientAgentInfos.length);

    const shas = filteredClientAgentInfos.map(info => info.id);
    console.log('shas', shas);

    const sessions = await getClientAgentSessions();
    console.log('sessions size', sessions.length);

    const filteredSessions = sessions.filter(session => !shas.includes(session.clientAgentSha));

    console.log('filteredSessions size', filteredSessions.length);

    await removeClientAgentSessions(filteredSessions);

    process.exit();
}

run();