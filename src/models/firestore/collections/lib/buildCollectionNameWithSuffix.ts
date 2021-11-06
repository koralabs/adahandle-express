import { isProduction } from "../../../../helpers/constants";

/**
 * @description adds '_dev' to the input string if not in production
 * 
 * @returns {string}
 */
export const buildCollectionNameWithSuffix = (collectionName: string): string => {
    return isProduction() ? collectionName : `${collectionName}_dev`;
}