import * as cardano from '@emurgo/cardano-serialization-lib-nodejs';
import { isProduction } from './constants';

export const getStakeCredFromAddress = (address: string): cardano.StakeCredential | null => {
    const addr = cardano.Address.from_bech32(address);
    const baseAddr = cardano.BaseAddress.from_address(addr)

    const stakeCred = baseAddr?.stake_cred() ?? null;
    return stakeCred;
}

export const getStakeKeyHexFromAddress = (address: string): string => {
    const stakeCred = getStakeCredFromAddress(address);
    const stakeCredBuffer = stakeCred?.to_keyhash()?.to_bytes().buffer ?? new Uint8Array(0);
    return Buffer.from(stakeCredBuffer).toString("hex");
}

export const getBech32StakeKeyFromAddress = (address: string): string | null => {
    const stakeCred = getStakeCredFromAddress(address);
    const stakeCredBuffer = stakeCred?.to_bytes().slice(4, 32) ?? new Uint8Array(0);

    const prefixBuffer = isProduction() ? [0xe1] : [0xe0];

    const reward_addr_bytes = new Uint8Array(29)
    reward_addr_bytes.set(prefixBuffer, 0)
    reward_addr_bytes.set(stakeCredBuffer, 1)

    const reward_addr = cardano.RewardAddress.from_address(cardano.Address.from_bytes(reward_addr_bytes));
    return reward_addr?.to_address()?.to_bech32() ?? '';
}