import * as child from 'child_process';

export const CHALLENGE_COMMAND = 'cncli challenge --domain test.com';
export const VERIFY_COMMAND = 'cncli verify --domain test.com --nonce ';

export const executeChildProcess = <T>(command: string): Promise<T> => {
    return new Promise((resolve, reject) => {
        child.exec(command, (err, stout, sterr) => {
            if (err) {
                reject(sterr);
                return;
            }

            const result = JSON.parse(stout);
            resolve(result);
        });
    });
}