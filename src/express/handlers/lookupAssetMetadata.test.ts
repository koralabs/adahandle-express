/* eslint-disable @typescript-eslint/ban-ts-comment */
// disabling ban-ts-comment is only acceptable in tests. And it's recommend to use very little when you can.
import { Request, Response } from 'express';

import { lookupAssetMetadataHandler } from './lookupAssetMetadata';
import { HEADER_HANDLE } from '../../helpers/constants';
import * as StateFixtures from '../../tests/stateFixture';
import * as blockfrost from '../../helpers/blockfrost';

jest.mock('../../helpers/jwt');
jest.mock('../../helpers/blockfrost');
StateFixtures.setupStateFixtures();

describe('lookupAssetMetadata Tests', () => {
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
            headers: {}
        };

        await lookupAssetMetadataHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
            error: {
                message: 'Missing handle parameter.'
            }
        });
    });

    it('should return a 404 when handle is not found on blockfrost', async () => {
        mockRequest = {
            headers: {
                [HEADER_HANDLE]: 'test_handle'
            }
        };

        jest.spyOn(blockfrost, 'fetchAsset').mockResolvedValue({
            error: {
                status_code: 404,
                error: 'Not Found',
                message: 'Some message'
            }
        });

        await lookupAssetMetadataHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({ error: { message: 'Not Found' } });
    });

    it('should return 200 and on-chain metadata', async () => {
        mockRequest = {
            headers: {
                [HEADER_HANDLE]: 'test_handle'
            }
        };

        const result = {
            asset: '8d18d786e92776c824607fd8e193ec535c79dc61ea2405ddf3b09fe3746573747472616e7331',
            policy_id: '8d18d786e92776c824607fd8e193ec535c79dc61ea2405ddf3b09fe3',
            asset_name: '746573747472616e7331',
            fingerprint: 'asset1wur6ff4xyyu7a7xe6lt6mp42zs67qf2zfdxnjl',
            quantity: '1',
            initial_mint_tx_hash: '44ec8cc4c7988d75a0dda055f0c5a7e0b01b1e2fee20c0e32913330d9d37e314',
            mint_or_burn_count: 1,
            onchain_metadata: {
                name: '$testtrans1',
                image: 'ipfs://QmTbhyuofvFZYs1X9eL7y4Rkk65QYdCDuEyS9iTtoAJRSa',
                core: {
                    og: 0,
                    prefix: '$',
                    version: 0,
                    termsofuse: 'https://adahandle.com/tou',
                    handleEncoding: 'utf-8'
                },
                website: 'https://adahandle.com',
                description: 'The Handle Standard',
                augmentations: []
            },
            metadata: null
        };

        jest.spyOn(blockfrost, 'fetchAsset').mockResolvedValue({ data: result });

        await lookupAssetMetadataHandler(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
            data: result.onchain_metadata
        });
    });
});
