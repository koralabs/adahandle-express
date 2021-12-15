import { awaitForEach, asyncForEach, promisedForEach, delay } from "../helpers/utils";

(async () =>{
    let resArray: number[] = [];
    const asyncStart = Date.now();
    console.log("STARTING promisedForEach()");
    await promisedForEach([1,2,3,4,5,6,7,8,9,10], async (item: number, index:number, arr: number[]) => {
        console.log(`starting promisedForEach item {${item}} at ${(Date.now() - asyncStart) / 1000} seconds`);
        await delay(3000);
        console.log(`finishing promisedForEach item {${item}} at ${(Date.now() - asyncStart) / 1000} seconds`);
        resArray.push(item);
    }, 250).then(() => {
        console.log(resArray);
        console.log(`CALL TIME for promisedForEach() time ${(Date.now() - asyncStart) / 1000} seconds`);
    });
    
    console.log(resArray);
    console.log(`TOTAL TIME for promisedForEach() time ${(Date.now() - asyncStart) / 1000} seconds`);

})();

(async () =>{
    let resArray: number[] = [];
    const asyncStart = Date.now();
    console.log("STARTING asyncForEach()");
    await asyncForEach([1,2,3,4,5,6,7,8,9,10], async (item: number, index:number, arr: number[]) => {
        console.log(`starting asyncForEach item {${item}} at ${(Date.now() - asyncStart) / 1000} seconds`);
        await delay(3000);
        console.log(`finishing asyncForEach item {${item}} at ${(Date.now() - asyncStart) / 1000} seconds`);
        resArray.push(item);
    }, 250).then(() => {
        console.log(resArray);
        console.log(`CALL TIME for asyncForEach() time ${(Date.now() - asyncStart) / 1000} seconds`);
    });
    
    console.log(resArray);
    console.log(`TOTAL TIME for asyncForEach() time ${(Date.now() - asyncStart) / 1000} seconds`);

})();

const awaitStart = Date.now();
console.log("STARTING awaitForEach()")
awaitForEach([1,2,3,4,5,6,7,8,9,10], async (item: number, index:number, arr: number[]) => {
    console.log(`starting awaitForEach item {${item}} at ${(Date.now() - awaitStart) / 1000} seconds`);
    await delay(5000);
    console.log(`finishing awaitForEach item {${item}} at ${(Date.now() - awaitStart) / 1000} seconds`);
}).then(() => {   
    console.log(`TOTAL awaitForEach() time ${(Date.now() - awaitStart) / 1000} seconds`)
});
