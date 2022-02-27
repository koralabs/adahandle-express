
import { SettingsRepo } from "../models/firestore/collections/SettingsRepo";
import { HandlePrice } from "../models/Settings"

export const getHandlePrices = async () => {
    const { fallBackAdaUsd, handlePriceSettings } = await SettingsRepo.getSettings();

    if (!handlePriceSettings){
        return;
    }

    return {
        basic: await setDynamicPriceByTier(handlePriceSettings.basic, fallBackAdaUsd),
        common: await setDynamicPriceByTier(handlePriceSettings.common, fallBackAdaUsd),
        rare: await setDynamicPriceByTier(handlePriceSettings.rare, fallBackAdaUsd),
        ultraRare: await setDynamicPriceByTier(handlePriceSettings.ultraRare, fallBackAdaUsd)
    }
}

const setDynamicPriceByTier = async (tier: HandlePrice, fallBackAdaUsd: number) => {
    const avergeAdaUsd = fallBackAdaUsd;
    //Get API endpoints here

    const differenceDollars = 1.25 - avergeAdaUsd;
    const differenceAda = differenceDollars / avergeAdaUsd;
    const changePercent = differenceDollars < 0 ? tier.underPercent : tier.overPercent;
    const adjustedPrice = (differenceAda * changePercent * tier.defaultPrice) / tier.weight

    if (differenceDollars < 0) {
        // Round down to nearest 5
        return Math.floor(adjustedPrice/5)*5;
    }
    else {
        // Round up to nearest 5
        return Math.ceil(adjustedPrice/5)*5;
    }
} 