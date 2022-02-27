
import { LogCategory, Logger } from "../helpers/Logger";
import { SettingsRepo } from "../models/firestore/collections/SettingsRepo";
import { HandlePrice } from "../models/Settings"

export const getHandlePrices = async () => {
    const { fallBackAdaUsd, handlePriceSettings } = await SettingsRepo.getSettings();

    if (!handlePriceSettings){
        return;
    }

    return {
        basic: await setPriceByTier(handlePriceSettings.basic, fallBackAdaUsd),
        common: await setPriceByTier(handlePriceSettings.common, fallBackAdaUsd),
        rare: await setPriceByTier(handlePriceSettings.rare, fallBackAdaUsd),
        ultraRare: await setPriceByTier(handlePriceSettings.ultraRare, fallBackAdaUsd)
    }
}

const setPriceByTier = async (tier: HandlePrice, fallBackAdaUsd: number) => {
    let avergeAdaUsd = fallBackAdaUsd;
    //Get API endpoints here

    const differenceDollars = 1.25 - avergeAdaUsd;
    const differenceAda = differenceDollars / avergeAdaUsd;
    
} 