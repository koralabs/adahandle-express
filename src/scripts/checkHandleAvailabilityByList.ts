import { Firebase } from "../helpers/firebase";
import * as admin from "firebase-admin";
import { asyncForEach } from "../helpers/utils";
import { ReservedHandles } from "../models/firestore/collections/ReservedHandles";
import { GraphqlHandleExistsResponse, handleExists } from "../helpers/graphql";
import { Color } from "./scriptUtils"

const handles = [
]

const run = async () => {
    await Firebase.init();
    const db = admin.firestore();

    await asyncForEach(handles, async (handle, index) => {
        console.log(`index ${index} for ${handle}`);
        const exists: GraphqlHandleExistsResponse = await handleExists(handle);
        const response = await ReservedHandles.checkAvailability(handle)
        if (!exists.exists && response.available) {
            console.log(`${Color.FgGreen}${handle}: existsOnChain=${exists.exists}, available=${response.available}${Color.Reset}`)
        }
        else {
            console.log(`${Color.FgRed}${handle}: existsOnChain=${exists.exists}, available=${response.available}${Color.Reset}`)
        }
    }, 250);
}

run();