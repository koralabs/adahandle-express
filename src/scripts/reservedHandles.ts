import { Firebase } from "../helpers/firebase";
import { ReservedHandles } from "../models/firestore/collections/ReservedHandles";


const run = async () => {
    await Firebase.init();

    const handles = await ReservedHandles.getReservedHandles();
    console.log('handles', handles);

    process.exit();
}

run();