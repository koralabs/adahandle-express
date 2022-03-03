
import axios from "axios";
import { SettingsRepo } from "../models/firestore/collections/SettingsRepo";
import { HandlePrice } from "../models/Settings"
import { Logger, LogCategory } from "./Logger";


export const getHandlePrices = async (priceParams: { adaUsdQuoteHistory: number[], lastQuoteTimestamp: number }) => {
    const { handlePriceSettings } = await SettingsRepo.getSettings();

    if (!handlePriceSettings) {
        return;
    }

    let avergeAdaUsd: number | undefined;
    if (priceParams.lastQuoteTimestamp < (Date.now() - (6 * 60 * 1000))) {
        let adaUsd: number[] = [];

        adaUsd = await getCurrentAdaUsdQuotes(adaUsd);

        if (adaUsd.length > 0) {
            avergeAdaUsd = (adaUsd.reduce((a, b) => a + b, 0) / (adaUsd.length || 1));
            // save every 6 minutes (times 20 entries = 2 hours of quotes)
            priceParams.lastQuoteTimestamp = Date.now();
            priceParams.adaUsdQuoteHistory.push(avergeAdaUsd);
            if (priceParams.adaUsdQuoteHistory.length > 20) {
                priceParams.adaUsdQuoteHistory = priceParams.adaUsdQuoteHistory.slice(1, 20);
            }
        }
    }

    avergeAdaUsd = (priceParams.adaUsdQuoteHistory.reduce((a, b) => a + b, 0) / (priceParams.adaUsdQuoteHistory.length || 1));

    return {
        basic: await setDynamicPriceByTier(handlePriceSettings.basic, avergeAdaUsd),
        common: await setDynamicPriceByTier(handlePriceSettings.common, avergeAdaUsd),
        rare: await setDynamicPriceByTier(handlePriceSettings.rare, avergeAdaUsd),
        ultraRare: await setDynamicPriceByTier(handlePriceSettings.ultraRare, avergeAdaUsd)
    }
}

const setDynamicPriceByTier = async (tier: HandlePrice, avergeAdaUsd: number) => {

    const differenceDollars = 1.24 - avergeAdaUsd;
    const differenceAda = differenceDollars / avergeAdaUsd;
    const changePercent = differenceDollars > 0 ? tier.underPercent : tier.overPercent;
    let adjustedPrice = ((differenceAda * changePercent * tier.defaultPrice) / tier.weight) + tier.defaultPrice
    if (adjustedPrice < 0) adjustedPrice = 0

    let rounded = 0;

    if (differenceDollars > 0) {
        // Round down to nearest 5
        rounded = Math.floor(adjustedPrice / 5) * 5;
    }
    else {
        // Round up to nearest 5
        rounded = Math.round(adjustedPrice / 5) * 5;
    }

    if (rounded > tier.maximum) return tier.maximum;
    if (rounded < tier.minimum) return tier.minimum;

    return rounded;

}

export const getCurrentAdaUsdQuotes = async (adaUsd: number[]) => {
    try {
        const coingeckoRes = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=cardano&vs_currencies=usd');
        if (coingeckoRes.status == 200) {
            adaUsd.push(coingeckoRes.data.cardano.usd);
        }
    }
    catch (e) { Logger.log({ category: LogCategory.ERROR, message: JSON.stringify(e), event: 'adausd.coingecko' }) }
    try {
        const coinMarketCap = await axios.get('https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=ADA&CMC_PRO_API_KEY=a6bfa301-8025-45f4-8fbf-c8b39fee5579');
        if (coinMarketCap.status == 200) {
            adaUsd.push(coinMarketCap.data.ADA[0].quote.USD.price);
        }
    }
    catch (e) { Logger.log({ category: LogCategory.ERROR, message: JSON.stringify(e), event: 'adausd.coinMarketCap' }) }
    try {
        const lunarcrush = await axios.get('https://api.lunarcrush.com/v2?data=assets&symbol=ADA');
        if (lunarcrush.status == 200) {
            adaUsd.push(lunarcrush.data.price);
        }
    }
    catch (e) { Logger.log({ category: LogCategory.ERROR, message: JSON.stringify(e), event: 'adausd.lunarcrush' }) }
    try {
        const messari = await axios.get('https://data.messari.io/api/v1/assets/ada/metrics');
        if (messari.status == 200) {
            adaUsd.push(messari.data.price);
        }
    }
    catch (e) { Logger.log({ category: LogCategory.ERROR, message: JSON.stringify(e), event: 'adausd.messari' }) }
    try {
        const coinbase = await axios.get('https://api.coinbase.com/v2/exchange-rates?currency=ada');
        if (coinbase.status == 200) {
            adaUsd.push(Number(coinbase.data.rates.USD));
        }
    }
    catch (e) { Logger.log({ category: LogCategory.ERROR, message: JSON.stringify(e), event: 'adausd.coinbase' }) }
    return filterOutliers(adaUsd);
}

export const filterOutliers = (someArray: number[]) => {  
    const mid = Math.floor(someArray.length / 2);
    const nums = [...someArray].sort((a, b) => a - b);
    const median = someArray.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
    const filtered: number[] = []
    console.log(median);
    someArray.forEach(num => {
        if (Math.abs((num-median) / median) <= .1) {
            filtered.push(num)
        }});
    return filtered;
}
