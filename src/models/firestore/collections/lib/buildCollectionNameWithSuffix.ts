import { isLocal, isProduction, isTesting } from "../../../../helpers/constants";

/**
 * @description adds suffix '_dev' based on environment
 *  - if in production, suffix is not added
 *  - if in testing, suffix is '_test'
 *  - default is '_dev'
 * 
 * @returns {string}
 */
export const buildCollectionNameWithSuffix = (collectionName: string): string => {
    if (isProduction()) return collectionName
    else if (isTesting() || isLocal()) return `${collectionName}_test`;
    return `${collectionName}_dev`;
}