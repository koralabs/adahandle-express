/* eslint-disable @typescript-eslint/ban-ts-comment */
// disabling ban-ts-comment is only acceptable in tests. And it's recommend to use very little when you can.
import { Request, Response } from 'express';
import * as cardanoAddresses from 'cardano-addresses';

import { lookupAddressHandler } from "./lookupAddress";
import { HEADER_HANDLE } from '../../helpers/constants';
import * as StateFixtures from '../../tests/stateFixture'
import * as fetchAssetsAddresses from "../../helpers/blockfrost";

jest.mock('../../helpers/jwt');
jest.mock('../../models/firestore/collections/ActiveSession');
jest.mock('../../helpers/blockfrost');
StateFixtures.setupStateFixtures();

describe('lookupAddress Tests', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;

    beforeEach(() => {
        mockRequest = {};
        mockResponse = {
            // @ts-ignore
            status: jest.fn(() => mockResponse),
            json: jest.fn()
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should send an 400 with handle', async () => {
        mockRequest = {
            headers: {
            }
        }

        await lookupAddressHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
            error: true,
            message: "Missing handle parameter."
        });
    });

    it('should return a 404 when handle is not found on blockfrost', async () => {
        mockRequest = {
            headers: {
                [HEADER_HANDLE]: 'test_handle'
            }
        }

        jest.spyOn(fetchAssetsAddresses, 'fetchAssetsAddresses').mockResolvedValue({ statusCode: 404, errorMessage: 'Not Found' });

        await lookupAddressHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({ assetName: '746573745f68616e646c65', error: false });
    });

    it('should return 200 and isShellyAddress=true with valid address_type', async () => {
        mockRequest = {
            headers: {
                [HEADER_HANDLE]: 'test_handle'
            }
        }

        jest.spyOn(fetchAssetsAddresses, 'fetchAssetsAddresses').mockResolvedValue({ address: 'test_address' });

        // @ts-expect-error
        jest.spyOn(cardanoAddresses, 'inspectAddress').mockResolvedValue({ address_type: 0 });

        await lookupAddressHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({ address: "test_address", assetName: "746573745f68616e646c65", error: false, isShellyAddress: true, addressType: 0 });
    });

    it('should return valid results for valid address_type(s)', async () => {
        mockRequest = {
            headers: {
                [HEADER_HANDLE]: 'test_handle'
            }
        }

        const addressTypes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 14, 15];

        jest.spyOn(fetchAssetsAddresses, 'fetchAssetsAddresses').mockResolvedValue({ address: 'test_address' });

        jest.spyOn(cardanoAddresses, 'inspectAddress')
            // @ts-expect-error
            .mockResolvedValueOnce({ address_type: 0 })
            // @ts-expect-error
            .mockResolvedValueOnce({ address_type: 1 })
            // @ts-expect-error
            .mockResolvedValueOnce({ address_type: 2 })
            // @ts-expect-error
            .mockResolvedValueOnce({ address_type: 3 })
            // @ts-expect-error
            .mockResolvedValueOnce({ address_type: 4 })
            // @ts-expect-error
            .mockResolvedValueOnce({ address_type: 5 })
            // @ts-expect-error
            .mockResolvedValueOnce({ address_type: 6 })
            // @ts-expect-error
            .mockResolvedValueOnce({ address_type: 7 })
            // @ts-expect-error
            .mockResolvedValueOnce({ address_type: 8 })
            // @ts-expect-error
            .mockResolvedValueOnce({ address_type: 14 })
            // @ts-expect-error
            .mockResolvedValueOnce({ address_type: 15 });

        for (let i = 0; i < addressTypes.length; i++) {
            const addressType = addressTypes[i];
            await lookupAddressHandler(mockRequest as Request, mockResponse as Response);
            const isShellyAddress = addressType < 8 && addressType % 2 === 0;
            expect(mockResponse.json).toHaveBeenCalledWith({ address: "test_address", assetName: "746573745f68616e646c65", error: false, isShellyAddress, addressType });

            // clear mock after each call
            //@ts-ignore
            mockResponse.json.mockClear();
        }
    });
});
