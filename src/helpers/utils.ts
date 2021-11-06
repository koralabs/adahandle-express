import { readFileSync } from 'fs';
import FingerPrint from '@emurgo/cip14-js';
import { getPolicyId } from './constants';

export const toLovelace = (adaAmount: number): number => adaAmount * 1000000;

export const chunk = <T>(input: T[], size: number) => {
    return input.reduce<T[][]>((arr: T[][], item: T, idx: number) => {
        return idx % size === 0
            ? [...arr, [item]]
            : [...arr.slice(0, -1), [...arr.slice(-1)[0], item]];
    }, []);
};

export const asyncForEach = async <T>(array: T[], callback: (item: T, index: number, array: T[]) => Promise<void>) => {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

export const delay = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export const getFingerprint = (handle: string): string => {
    return FingerPrint.fromParts(
        Buffer.from(getPolicyId(), 'hex'),
        Buffer.from(handle)
    ).fingerprint();
}