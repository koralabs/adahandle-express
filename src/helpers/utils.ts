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

export const awaitForEach = async <T>(array: T[], callback: (item: T, index: number, array: T[]) => Promise<void>) => {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

// Used to execute Promises in order, but still async. 
// Good for adding delay between API calls and you need the complete list of results when they all resolve
export const asyncForEach = async <T, U>(array: T[], callback: (item: T, index: number, array: T[]) => Promise<U>, delayInMilliseconds = 0) => {
    const promises: Promise<U>[] = [];
    for (let index = 0; index < array.length; index++) {
        promises.push(callback(array[index], index, array));
        if (delayInMilliseconds > 0) {
            await delay(delayInMilliseconds);
        }
    }
    return Promise.all(promises);
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

export const calculatePositionAndMinutesInQueue = (queueSize: number, lastTimestamp: number, userTimestamp: number, queueLimit: number) => {
    if (queueSize <= queueLimit) {
        return { position: 0, minutes: 0 };
    }
    if (userTimestamp <= lastTimestamp) {
        return { position: 0, minutes: 0 };
    }
    const currentTimestamp = Date.now();
    const position = Math.round(((userTimestamp - lastTimestamp) / (currentTimestamp - lastTimestamp)) * queueSize);
    const minutes = Math.round(position / queueLimit);
    return { position, minutes };
}

export const isNumeric = (n: string) => {
    return !isNaN(parseFloat(n)) && isFinite(parseFloat(n));
}

export const verifyIsAlphaNumeric = (str: string): boolean => {
    return /^[a-zA-Z0-9]+$/.test(str);
}

export const verifyIsPoolId = (str: string): boolean => {
    return /^pool([a-zA-Z0-9]+$)/.test(str);
}