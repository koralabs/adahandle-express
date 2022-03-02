
import axios from "axios";
import { SettingsRepo } from "../models/firestore/collections/SettingsRepo";
import { HandlePrice } from "../models/Settings"
import { Logger, LogCategory } from "./Logger";


export const getHandlePrices = async () => {
    const { fallBackAdaUsd, handlePriceSettings } = await SettingsRepo.getSettings();

    if (!handlePriceSettings) {
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
    let avergeAdaUsd = fallBackAdaUsd;
    //Get API endpoints here
    const adaUsd: number[] = [];

    getAdaUsdQuotes(adaUsd);

    if (adaUsd.length>0){
        avergeAdaUsd = (adaUsd.reduce((a, b) => a + b) / adaUsd.length);
    }

    const differenceDollars = 1.25 - avergeAdaUsd;
    const differenceAda = differenceDollars / avergeAdaUsd;
    const changePercent = differenceDollars < 0 ? tier.underPercent : tier.overPercent;
    const adjustedPrice = (differenceAda * changePercent * tier.defaultPrice) / tier.weight

    let rounded = 0;

    if (differenceDollars < 0) {
        // Round down to nearest 5
        rounded = Math.floor(adjustedPrice / 5) * 5;
    }
    else {
        // Round up to nearest 5
        rounded = Math.ceil(adjustedPrice / 5) * 5;
    }

    if (rounded > tier.maximum)
    {
        return tier.maximum;
    }
    if (rounded < tier.minimum)
    {
        return tier.minimum;
    }

    return rounded;
    
} 

const getAdaUsdQuotes = async (adaUsd: number[]) =>{
    try {
        const coingeckoRes = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=cardano&vs_currencies=usd');
        if (coingeckoRes.status == 200) {
            adaUsd.push(coingeckoRes.data.cardano.usd);
        }
    }
    catch (e) { Logger.log({ category: LogCategory.ERROR, message: JSON.stringify(e), event: 'adausd.coingecko' }) }
}

