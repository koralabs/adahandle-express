import * as child from 'child_process';

export const DOMAIN = 'adahandle.com';
export const CHALLENGE_COMMAND = `cncli challenge --domain ${DOMAIN}`;
export const buildVerifyCommend = ({ vkeyLocation, vKeyHash, nonce, signature }: { vkeyLocation: string, vKeyHash: string, nonce: string, signature: string }) => `cncli verify --pool-vrf-vkey ${vkeyLocation} --pool-vrf-vkey-hash ${vKeyHash} --domain ${DOMAIN} --nonce ${nonce} --signature ${signature}`;

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