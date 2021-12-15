
import { getIPFSImage } from '../../helpers/image';
import { delay } from "../../helpers/utils";
const requestsPerMinute = 300;

(async () => {
    let ipfs: string;
    try {
        for(var i=0;i<10000;i++){
            console.log(`processing #${i}`);
            getIPFSImage(i.toString(), false, 0, 0).then((ipfs) => {console.log(`ipfs for #${i}==${ipfs}`)});
            await delay((60/requestsPerMinute)*1000);
        }
    } catch(e) {
        console.log(e);
    }
})();