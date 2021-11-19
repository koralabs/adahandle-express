import * as fs from 'fs';
import { isLocal, isTesting } from '../helpers/constants';


const run = async () => {
    const fileName = `${process.cwd()}/dist/adahandle-client-agent-info/src/index.js`;
    console.log('fileName', fileName);

    try {
        if (fs.existsSync(fileName)) {
            const { verifyClientAgentInfo } = await import(fileName);
            const verifiedInfo = verifyClientAgentInfo('clientAgent');
            if (!verifiedInfo) {
                console.log('false');
                return;
            }

            console.log('true');
        } else if (!isLocal() || !isTesting()) {
            throw new Error('Missing adahandle-client-agent-info');
        }
    } catch (error) {
        console.log(error);
        throw error;
    }

}

run();