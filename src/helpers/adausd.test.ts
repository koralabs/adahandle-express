import { SettingsRepo } from '../models/firestore/collections/SettingsRepo';
import { Settings } from '../models/Settings';
import * as adaUsd from './adausd'

describe('Pricing Tests', () => {
    const getCurrentAdaUsdQuotesSpy = jest.spyOn(adaUsd, 'getCurrentAdaUsdQuotes');
    const settingsSpy = jest.spyOn(SettingsRepo, 'getSettings').mockResolvedValue({handlePriceSettings: {
        basic: {
            defaultPrice: 10,
            weight: .16,
            underPercent: .10,
            overPercent: .14,
            minimum: 1,
            maximum: 15
        },
        common: {
            defaultPrice: 50,
            weight: .44,
            underPercent: .20,
            overPercent: .47,
            minimum: 2,
            maximum: 95
        },
        rare: {
            defaultPrice: 100,
            weight: .13438,
            underPercent: .40,
            overPercent: .125,
            minimum: 3,
            maximum: 445
        },
        ultraRare: {
            defaultPrice: 500,
            weight: .26772,
            underPercent: .30,
            overPercent: .265,
            minimum: 5,
            maximum: 995
        }}} as Settings)
    
    it('Should return correct prices', async () => {
        let priceParams = { adaUsdQuoteHistory: [], lastQuoteTimestamp: (Date.now() - (7 * 60 * 1000))}
        getCurrentAdaUsdQuotesSpy.mockImplementation(async () => { return [.01] })
        let prices = await adaUsd.getHandlePrices(priceParams);
        expect(prices).toEqual({basic:15,common:95,rare:445,ultraRare:995});

        priceParams = { adaUsdQuoteHistory: [], lastQuoteTimestamp: (Date.now() - (7 * 60 * 1000))}
        getCurrentAdaUsdQuotesSpy.mockImplementation(async () => { return [.1] })
        prices = await adaUsd.getHandlePrices(priceParams);
        expect(prices).toEqual({basic:15,common:95,rare:445,ultraRare:995});

        priceParams = { adaUsdQuoteHistory: [], lastQuoteTimestamp: (Date.now() - (7 * 60 * 1000))}
        getCurrentAdaUsdQuotesSpy.mockImplementation(async () => { return [.5] })
        prices = await adaUsd.getHandlePrices(priceParams);
        expect(prices).toEqual({basic:15,common:80,rare:445,ultraRare:995});

        priceParams = { adaUsdQuoteHistory: [], lastQuoteTimestamp: (Date.now() - (7 * 60 * 1000))}
        getCurrentAdaUsdQuotesSpy.mockImplementation(async () => { return [1] })
        prices = await adaUsd.getHandlePrices(priceParams);
        expect(prices).toEqual({basic:10,common:55,rare:170,ultraRare:630});

        priceParams = { adaUsdQuoteHistory: [], lastQuoteTimestamp: (Date.now() - (7 * 60 * 1000))}
        getCurrentAdaUsdQuotesSpy.mockImplementation(async () => { return [1.23] })
        prices = await adaUsd.getHandlePrices(priceParams);
        expect(prices).toEqual({basic:10,common:50,rare:100,ultraRare:500});

        priceParams = { adaUsdQuoteHistory: [], lastQuoteTimestamp: (Date.now() - (7 * 60 * 1000))}
        getCurrentAdaUsdQuotesSpy.mockImplementation(async () => { return [1.24] })
        prices = await adaUsd.getHandlePrices(priceParams);
        expect(prices).toEqual({basic:10,common:50,rare:100,ultraRare:500});

        priceParams = { adaUsdQuoteHistory: [], lastQuoteTimestamp: (Date.now() - (7 * 60 * 1000))}
        getCurrentAdaUsdQuotesSpy.mockImplementation(async () => { return [1.25] })
        prices = await adaUsd.getHandlePrices(priceParams);
        expect(prices).toEqual({basic:10,common:50,rare:100,ultraRare:495});

        priceParams = { adaUsdQuoteHistory: [], lastQuoteTimestamp: (Date.now() - (7 * 60 * 1000))}
        getCurrentAdaUsdQuotesSpy.mockImplementation(async () => { return [2] })
        prices = await adaUsd.getHandlePrices(priceParams);
        expect(prices).toEqual({basic:5,common:30,rare:65,ultraRare:310});

        priceParams = { adaUsdQuoteHistory: [], lastQuoteTimestamp: (Date.now() - (7 * 60 * 1000))}
        getCurrentAdaUsdQuotesSpy.mockImplementation(async () => { return [5] })
        prices = await adaUsd.getHandlePrices(priceParams);
        expect(prices).toEqual({basic:5,common:10,rare:30,ultraRare:130});

        priceParams = { adaUsdQuoteHistory: [], lastQuoteTimestamp: (Date.now() - (7 * 60 * 1000))}
        getCurrentAdaUsdQuotesSpy.mockImplementation(async () => { return [10] })
        prices = await adaUsd.getHandlePrices(priceParams);
        expect(prices).toEqual({basic:1,common:5,rare:20,ultraRare:65});

        priceParams = { adaUsdQuoteHistory: [], lastQuoteTimestamp: (Date.now() - (7 * 60 * 1000))}
        getCurrentAdaUsdQuotesSpy.mockImplementation(async () => { return [15] })
        prices = await adaUsd.getHandlePrices(priceParams);
        expect(prices).toEqual({basic:1,common:2,rare:15,ultraRare:45});

        priceParams = { adaUsdQuoteHistory: [], lastQuoteTimestamp: (Date.now() - (7 * 60 * 1000))}
        getCurrentAdaUsdQuotesSpy.mockImplementation(async () => { return [20] })
        prices = await adaUsd.getHandlePrices(priceParams);
        expect(prices).toEqual({basic:1,common:2,rare:15,ultraRare:35});

        priceParams = { adaUsdQuoteHistory: [], lastQuoteTimestamp: (Date.now() - (7 * 60 * 1000))}
        getCurrentAdaUsdQuotesSpy.mockImplementation(async () => { return [50] })
        prices = await adaUsd.getHandlePrices(priceParams);
        expect(prices).toEqual({basic:1,common:2,rare:10,ultraRare:15});

        priceParams = { adaUsdQuoteHistory: [], lastQuoteTimestamp: (Date.now() - (7 * 60 * 1000))}
        getCurrentAdaUsdQuotesSpy.mockImplementation(async () => { return [100] })
        prices = await adaUsd.getHandlePrices(priceParams);
        expect(prices).toEqual({basic:1,common:2,rare:10,ultraRare:10});
    });
});