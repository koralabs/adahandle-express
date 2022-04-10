import * as child from 'child_process';

export const DOMAIN = 'adahandle.com';

export const runChallengeCommand = <T>(): Promise<T> => {
    return new Promise((resolve, reject) => {
        child.exec(`cncli challenge --domain ${DOMAIN}`, (err, stout, sterr) => {
            if (err) {
                reject(sterr);
                return;
            }

            const result = JSON.parse(stout);
            resolve(result);
        });
    });
}

export const runVerifyCommand = <T>({ vkeyLocation, vKeyHash, nonce, signature }: { vkeyLocation: string, vKeyHash: string, nonce: string, signature: string }): Promise<T> => {
    return new Promise((resolve, reject) => {
        child.exec(`cncli verify --pool-vrf-vkey ${vkeyLocation} --pool-vrf-vkey-hash ${vKeyHash} --domain ${DOMAIN} --nonce ${nonce} --signature ${signature}`, (err, stout, sterr) => {
            if (err) {
                reject(sterr);
                return;
            }

            const result = JSON.parse(stout);
            resolve(result);
        });
    });
}