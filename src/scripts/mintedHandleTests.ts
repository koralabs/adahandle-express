import { Firebase } from "../helpers/firebase";
import { MintedHandles } from "../models/firestore/collections/MintedHandles";
import { MintedHandle } from "../models/MintedHandle";


const run = async () => {
    await Firebase.init();
    await MintedHandles.addMintedHandle(new MintedHandle('burrito'));

    const handles = await MintedHandles.getMintedHandles();
    console.log('handles', handles);
    process.exit();
}


run();