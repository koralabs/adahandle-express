import { betahandles } from "./betahandles"
import { ReservedHandles } from "../../models/firestore/collections/ReservedHandles"
import { Firebase } from "../../helpers/firebase";
import { asyncForEach } from "../../helpers/utils"
import { Color } from "../scriptUtils"

const average = (array: number[]) => array.reduce((a: number, b: number) => a + b) / array.length;
const run = async () => {
    await Firebase.init();
    console.time("reserved handles testing");
    const durations: number[] = []
    const reset = Color.Reset;
    let badWordsCount = 0;
    const listToCheck = smallList;// <- replace with betahandles to test 15K handles performance
    await asyncForEach(listToCheck, async (handle) => {  
        const avail = await ReservedHandles.checkAvailability(handle);
        durations.push(avail.duration || 0);
        let color = avail.available ? Color.FgGreen : Color.FgRed
        !avail.available ? badWordsCount++ : null;
        console.log(`${avail.duration?.toString().padEnd(6)} processing "${color}${(handle + "\"").padEnd(16)}${reset} - AVAILABLE: ${color}${avail.available}${reset} REASON: ${avail.reason} MESSAGE: ${avail.debug ?? avail.message}`);
    }, 25)
    console.log(`average processing time per handle ${average(durations)}`)
    console.log(`minimum processing time per handle ${Math.min(...durations)}`)
    console.log(`maximum processing time per handle ${Math.max(...durations)}`)
    console.log(`found ${badWordsCount} bad words in ${listToCheck.length}`)
    console.timeEnd("reserved handles testing");
}

const smallList = [
    "shittum", // good
    "ea.tmy5_hit", // bad
    "s.h.i.t", // bad
    "punchbabies", //bad
    "i.love.life", // good
    "adastaker", // twitter
    "Xar", // private
    "blade", // SPO
    "AdAhQ", // SPO
    "lickmycooch", // bad
    "peckerhead", // bad
    "myahole", // bad
    "ipedophile", //bad
    "love2lickbabies", // bad
    "ilovebabies", // good
    "power2africa" // good
]

run();
