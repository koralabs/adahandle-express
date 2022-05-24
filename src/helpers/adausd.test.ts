import { SettingsRepo } from "../models/firestore/collections/SettingsRepo";
import { Settings } from "../models/Settings";
import * as adaUsd from "./adausd";
import { getCurrentAdaUsdQuotes } from "./adausd";
import { Logger } from "./Logger";

describe("Pricing Tests", () => {
    const settingsSpy = jest.spyOn(SettingsRepo, "getSettings").mockResolvedValue({
        handlePriceSettings: {
            basic: {
                defaultPrice: 10,
                weight: 0.16,
                underPercent: 0.1,
                overPercent: 0.14,
                minimum: 1,
                maximum: 15
            },
            common: {
                defaultPrice: 50,
                weight: 0.44,
                underPercent: 0.2,
                overPercent: 0.47,
                minimum: 2,
                maximum: 95
            },
            rare: {
                defaultPrice: 100,
                weight: 0.13438,
                underPercent: 0.4,
                overPercent: 0.125,
                minimum: 3,
                maximum: 445
            },
            ultraRare: {
                defaultPrice: 500,
                weight: 0.26772,
                underPercent: 0.3,
                overPercent: 0.265,
                minimum: 5,
                maximum: 995
            }
        }
    } as Settings);

    it("should throw error if there are 3 errors", async () => {
        jest.spyOn(adaUsd, "priceQuoteApiRequest")
            .mockResolvedValue(10)
            .mockRejectedValueOnce(new Error("error1"))
            .mockRejectedValueOnce(new Error("error2"))
            .mockRejectedValueOnce(new Error("error3"));

        const loggerSpy = jest.spyOn(Logger, "log");

        await getCurrentAdaUsdQuotes([]);

        expect(loggerSpy).toHaveBeenCalledWith({
            category: "NOTIFY",
            event: "adausd.priceQuoteRequest.tooManyErrors",
            message: "Received 3 errors out of 5 requests during priceQuoteRequest"
        });
    });

    it("Should return correct prices", async () => {
        const getCurrentAdaUsdQuotesSpy = jest.spyOn(adaUsd, "getCurrentAdaUsdQuotes");

        let priceParams = { adaUsdQuoteHistory: [], lastQuoteTimestamp: Date.now() - 7 * 60 * 1000 };
        getCurrentAdaUsdQuotesSpy.mockImplementation(async () => {
            return [0.01];
        });
        let prices = await adaUsd.getHandlePrices(priceParams);
        expect(prices).toEqual({ basic: 15, common: 95, rare: 445, ultraRare: 995 });

        priceParams = { adaUsdQuoteHistory: [], lastQuoteTimestamp: Date.now() - 7 * 60 * 1000 };
        getCurrentAdaUsdQuotesSpy.mockImplementation(async () => {
            return [0.1];
        });
        prices = await adaUsd.getHandlePrices(priceParams);
        expect(prices).toEqual({ basic: 15, common: 95, rare: 445, ultraRare: 995 });

        priceParams = { adaUsdQuoteHistory: [], lastQuoteTimestamp: Date.now() - 7 * 60 * 1000 };
        getCurrentAdaUsdQuotesSpy.mockImplementation(async () => {
            return [0.5];
        });
        prices = await adaUsd.getHandlePrices(priceParams);
        expect(prices).toEqual({ basic: 15, common: 80, rare: 445, ultraRare: 995 });

        priceParams = { adaUsdQuoteHistory: [], lastQuoteTimestamp: Date.now() - 7 * 60 * 1000 };
        getCurrentAdaUsdQuotesSpy.mockImplementation(async () => {
            return [1.0];
        });
        prices = await adaUsd.getHandlePrices(priceParams);
        expect(prices).toEqual({ basic: 10, common: 55, rare: 170, ultraRare: 630 });

        priceParams = { adaUsdQuoteHistory: [], lastQuoteTimestamp: Date.now() - 7 * 60 * 1000 };
        getCurrentAdaUsdQuotesSpy.mockImplementation(async () => {
            return [1.23];
        });
        prices = await adaUsd.getHandlePrices(priceParams);
        expect(prices).toEqual({ basic: 10, common: 50, rare: 100, ultraRare: 500 });

        priceParams = { adaUsdQuoteHistory: [], lastQuoteTimestamp: Date.now() - 7 * 60 * 1000 };
        getCurrentAdaUsdQuotesSpy.mockImplementation(async () => {
            return [1.24];
        });
        prices = await adaUsd.getHandlePrices(priceParams);
        expect(prices).toEqual({ basic: 10, common: 50, rare: 100, ultraRare: 500 });

        priceParams = { adaUsdQuoteHistory: [], lastQuoteTimestamp: Date.now() - 7 * 60 * 1000 };
        getCurrentAdaUsdQuotesSpy.mockImplementation(async () => {
            return [1.25];
        });
        prices = await adaUsd.getHandlePrices(priceParams);
        expect(prices).toEqual({ basic: 10, common: 50, rare: 100, ultraRare: 495 });

        priceParams = { adaUsdQuoteHistory: [], lastQuoteTimestamp: Date.now() - 7 * 60 * 1000 };
        getCurrentAdaUsdQuotesSpy.mockImplementation(async () => {
            return [2.0];
        });
        prices = await adaUsd.getHandlePrices(priceParams);
        expect(prices).toEqual({ basic: 5, common: 30, rare: 65, ultraRare: 310 });

        priceParams = { adaUsdQuoteHistory: [], lastQuoteTimestamp: Date.now() - 7 * 60 * 1000 };
        getCurrentAdaUsdQuotesSpy.mockImplementation(async () => {
            return [5.0];
        });
        prices = await adaUsd.getHandlePrices(priceParams);
        expect(prices).toEqual({ basic: 5, common: 10, rare: 30, ultraRare: 130 });

        priceParams = { adaUsdQuoteHistory: [], lastQuoteTimestamp: Date.now() - 7 * 60 * 1000 };
        getCurrentAdaUsdQuotesSpy.mockImplementation(async () => {
            return [10.0];
        });
        prices = await adaUsd.getHandlePrices(priceParams);
        expect(prices).toEqual({ basic: 1, common: 5, rare: 20, ultraRare: 65 });

        priceParams = { adaUsdQuoteHistory: [], lastQuoteTimestamp: Date.now() - 7 * 60 * 1000 };
        getCurrentAdaUsdQuotesSpy.mockImplementation(async () => {
            return [15.0];
        });
        prices = await adaUsd.getHandlePrices(priceParams);
        expect(prices).toEqual({ basic: 1, common: 2, rare: 15, ultraRare: 45 });

        priceParams = { adaUsdQuoteHistory: [], lastQuoteTimestamp: Date.now() - 7 * 60 * 1000 };
        getCurrentAdaUsdQuotesSpy.mockImplementation(async () => {
            return [20.0];
        });
        prices = await adaUsd.getHandlePrices(priceParams);
        expect(prices).toEqual({ basic: 1, common: 2, rare: 15, ultraRare: 35 });

        priceParams = { adaUsdQuoteHistory: [], lastQuoteTimestamp: Date.now() - 7 * 60 * 1000 };
        getCurrentAdaUsdQuotesSpy.mockImplementation(async () => {
            return [50.0];
        });
        prices = await adaUsd.getHandlePrices(priceParams);
        expect(prices).toEqual({ basic: 1, common: 2, rare: 10, ultraRare: 15 });

        priceParams = { adaUsdQuoteHistory: [], lastQuoteTimestamp: Date.now() - 7 * 60 * 1000 };
        getCurrentAdaUsdQuotesSpy.mockImplementation(async () => {
            return [100.0];
        });
        prices = await adaUsd.getHandlePrices(priceParams);
        expect(prices).toEqual({ basic: 1, common: 2, rare: 10, ultraRare: 10 });
    });
});
