import * as fs from 'fs';
import { CreatedBySystem } from "../helpers/constants";
import { Firebase } from "../helpers/firebase";
import { ActiveSession, Status, WorkflowStatus } from "../models/ActiveSession";
import { ActiveSessions } from "../models/firestore/collections/ActiveSession";


const run = async () => {
    await Firebase.init();
    let returnAddressesJson = fs.readFileSync('./src/scripts/return01.json');
    let returnAddresses = JSON.parse(returnAddressesJson.toString());

    for (const address of returnAddresses) {
        const handle = await makeid(15)
        const activeSession = new ActiveSession({
            createdBySystem: CreatedBySystem.UI,
            attempts: 0,
            emailAddress: 'testing@adahandle.com',
            cost: 10,
            handle,
            paymentAddress: 'addr_test1qpmahg4683csr3jfe9rxmgwre7qu73c5sededh5nl04g3durj3kgal4597evfpv5adcvdtkmu6qwqhwqtg6hsu2p7ajsn4nl5e',
            start: Date.now(),
            dateAdded: Date.now(),
            index: 0,
            status: Status.PAID,
            workflowStatus: WorkflowStatus.PENDING,
            returnAddress: address.id
        });
        await ActiveSessions.addActiveSession(activeSession);
    }
}

const makeid = async (length: number) => {
    var result = '';
    var characters = 'abcdefghijklmnopqrstuvwxyz-._0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

run();