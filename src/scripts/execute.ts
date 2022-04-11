import { executeChildProcess } from '../helpers/executeChildProcess';

interface ChallengeResult {
    status: string;
    domain: string;
    nonce: string;
}

const run = async () => {
    try {
        const result = await executeChildProcess<ChallengeResult>('cncli challenge --domain test.com');
        console.log('result', result.nonce);
    } catch (error) {
        console.log('errorzzz', error);
    }
};

run();