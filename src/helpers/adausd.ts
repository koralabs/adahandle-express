import axios from "axios";
import { SettingsRepo } from "../models/firestore/collections/SettingsRepo";
import { HandlePrice } from "../models/Settings";
import { isProduction } from "./constants";
import { Logger, LogCategory } from "./Logger";
import { isNumeric } from "./utils";

export const getHandlePrices = async (priceParams: { adaUsdQuoteHistory: number[]; lastQuoteTimestamp: number }) => {
    const { handlePriceSettings, priceTestMode, priceAdaUsdTest } = await SettingsRepo.getSettings();

    if (!handlePriceSettings) {
        return;
    }

    let avergeAdaUsd: number | undefined;
    if (priceParams.lastQuoteTimestamp < Date.now() - 6 * 60 * 1000) {
        let adaUsd: number[] = [];

        adaUsd = await getCurrentAdaUsdQuotes(adaUsd);

        if (adaUsd.length > 0) {
            avergeAdaUsd = adaUsd.reduce((a, b) => a + b, 0) / (adaUsd.length || 1);
            if (!isProduction() && priceTestMode == "SKIP_APIS") {
                avergeAdaUsd = priceAdaUsdTest;
            }
            // save every 6 minutes (times 20 entries = 2 hours of quotes)
            priceParams.lastQuoteTimestamp = Date.now();
            priceParams.adaUsdQuoteHistory.push(avergeAdaUsd);
            if (priceParams.adaUsdQuoteHistory.length > 20) {
                priceParams.adaUsdQuoteHistory = priceParams.adaUsdQuoteHistory.slice(1, 20);
            }
        }
    }

    avergeAdaUsd =
        priceParams.adaUsdQuoteHistory.reduce((a, b) => a + b, 0) / (priceParams.adaUsdQuoteHistory.length || 1);

    if (!isProduction() && priceTestMode == "SKIP_MA") {
        avergeAdaUsd = priceAdaUsdTest;
    }

    return {
        basic: await setDynamicPriceByTier(handlePriceSettings.basic, avergeAdaUsd),
        common: await setDynamicPriceByTier(handlePriceSettings.common, avergeAdaUsd),
        rare: await setDynamicPriceByTier(handlePriceSettings.rare, avergeAdaUsd),
        ultraRare: await setDynamicPriceByTier(handlePriceSettings.ultraRare, avergeAdaUsd)
    };
};

const setDynamicPriceByTier = async (tier: HandlePrice, avergeAdaUsd: number) => {
    const differenceDollars = 1.24 - avergeAdaUsd;
    const differenceAda = differenceDollars / avergeAdaUsd;
    const changePercent = differenceDollars > 0 ? tier.underPercent : tier.overPercent;
    let adjustedPrice = (differenceAda * changePercent * tier.defaultPrice) / tier.weight + tier.defaultPrice;
    if (adjustedPrice < 0) adjustedPrice = 0;

    let rounded = 0;

    if (differenceDollars > 0) {
        // Round down to nearest 5
        rounded = Math.floor(adjustedPrice / 5) * 5;
    } else {
        // Round up to nearest 5
        rounded = Math.round(adjustedPrice / 5) * 5;
    }

    if (rounded > tier.maximum) return tier.maximum;
    if (rounded < tier.minimum) return tier.minimum;

    return rounded;
};

export const getCurrentAdaUsdQuotes = async (adaUsd: number[]): Promise<number[]> => {
    const apis = [
        {
            url: "https://api.coingecko.com/api/v3/simple/price?ids=cardano&vs_currencies=usd",
            jsonPath: "cardano.usd"
        },
        {
            url: `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=ADA&CMC_PRO_API_KEY=${process.env.CMC_PRO_API_KEY}`,
            jsonPath: "data.ADA.0.quote.USD.price"
        },
        {
            url: "https://api.lunarcrush.com/v2?data=assets&symbol=ADA",
            jsonPath: "data.0.price"
        },
        {
            url: "https://data.messari.io/api/v1/assets/ada/metrics",
            jsonPath: "data.market_data.price_usd"
        },
        {
            url: "https://api.coinbase.com/v2/exchange-rates?currency=ada",
            jsonPath: "data.rates.USD"
        }
    ];

    for (let i = 0; i < apis.length; i++) {
        const priceQuote = await priceQuoteApiRequest(apis[i].url, apis[i].jsonPath);
        if (priceQuote) {
            adaUsd.push(typeof priceQuote == "string" ? Number(priceQuote) : priceQuote);
        }
    }
    return filterOutliers(adaUsd);
};

export const filterOutliers = (someArray: number[]): number[] => {
    const mid = Math.floor(someArray.length / 2);
    const nums = [...someArray].sort((a, b) => a - b);
    const median = someArray.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
    const filtered: number[] = [];
    someArray.forEach((num) => {
        if (Math.abs((num - median) / median) <= 0.1) {
            filtered.push(num);
        }
    });
    return filtered;
};

export const priceQuoteApiRequest = async (url: string, jsonPath: string) => {
    try {
        const priceQuote = await axios.get(url);
        if (priceQuote.status == 200) {
            const parts = jsonPath.split(".");
            let result = priceQuote.data;
            for (let i = 0; i < parts.length; i++) {
                result = isNumeric(parts[i]) ? result[parseInt(parts[i])] : result[parts[i]];
            }
            return result;
        } else {
            Logger.log({
                category: LogCategory.INFO,
                message: `Price quote: non-200 HTTP Response on ${url} ${priceQuote.status}: ${priceQuote.statusText} - ${priceQuote.data}`,
                event: "adausd.priceQuoteRequest"
            });
        }
    } catch (e) {
        Logger.log({
            category: LogCategory.ERROR,
            message: JSON.stringify(e),
            event: "adausd.priceQuoteRequest"
        });
    }
};

// Leave this hear to test APIs locally
// if (process.env.NODE_ENV == 'test')
//     (async () => {console.log(await getCurrentAdaUsdQuotes([]));})();
