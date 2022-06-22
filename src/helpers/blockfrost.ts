import { getBlockfrostApiKey, getPolicyId, isProduction } from './constants';
import fetch from 'cross-fetch';

export interface FetchAssetsAddressesResult {
    address?: string;
    errorMessage?: string;
    statusCode?: number;
}

interface BlockFrostAssetsAddressesErrorResultBody {
    error: string; // "NotFound", "Forbidden"
    message: string;
    status_code: number;
}

interface BlockFrostAssetsAddressesResultBody {
    address: string;
    quantity: string; // "1"
}

interface BlockFrostPoolDetailsResultBody {
    error?: string; // "NotFound", "Forbidden"
    message?: string;
    status_code?: number;
    pool_id?: string;
    vrf_key?: string;
    registration?: string[];
    retirement?: string[];
}

export interface BlockFrostAssetResultBody {
    asset: string;
    policy_id: string;
    asset_name: string;
    fingerprint: string;
    quantity: string;
    initial_mint_tx_hash: string;
    mint_or_burn_count: number;
    onchain_metadata: {
        name: string;
        image: string;
        core: {
            og: number;
            prefix: string;
            version: number;
            termsofuse: string;
            handleEncoding: string;
        };
        website: string;
        description: string;
        augmentations: any[];
    };
    metadata: null;
}

export interface BlockfrostErrorResponseBody {
    error: string;
    message: string;
    status_code: number;
}

const getBlockfrostContext = (): {
    context: string;
    policyId: string;
    blockfrostApiKey: string;
} => {
    const context = isProduction() ? 'mainnet' : 'testnet';
    const policyId = getPolicyId();
    const blockfrostApiKey = getBlockfrostApiKey();

    return {
        context,
        policyId,
        blockfrostApiKey
    };
};

export const fetchAssetsAddresses = async (handle: string): Promise<FetchAssetsAddressesResult> => {
    const { context, policyId, blockfrostApiKey } = getBlockfrostContext();

    const assetName = Buffer.from(handle).toString('hex');
    const data: BlockFrostAssetsAddressesErrorResultBody | BlockFrostAssetsAddressesResultBody[] = await fetch(
        `https://cardano-${context}.blockfrost.io/api/v0/assets/${policyId}${assetName}/addresses`,
        {
            headers: {
                project_id: blockfrostApiKey,
                'Content-Type': 'application/json'
            }
        }
    ).then((res) => res.json());

    if (Array.isArray(data)) {
        const [result] = data;

        return {
            address: result.address
        };
    }

    return {
        errorMessage: data.error,
        statusCode: data.status_code
    };
};

export const fetchPoolDetails = async (poolId: string): Promise<BlockFrostPoolDetailsResultBody> => {
    const { context, blockfrostApiKey } = getBlockfrostContext();

    const data: BlockFrostPoolDetailsResultBody = await fetch(
        `https://cardano-${context}.blockfrost.io/api/v0/pools/${poolId}`,
        {
            headers: {
                project_id: blockfrostApiKey,
                'Content-Type': 'application/json'
            }
        }
    ).then((res) => res.json());

    return data;
};

export const fetchAsset = async (
    handle: string
): Promise<{ error?: BlockfrostErrorResponseBody; data?: BlockFrostAssetResultBody }> => {
    const { context, policyId, blockfrostApiKey } = getBlockfrostContext();

    const assetName = Buffer.from(handle).toString('hex');
    const data = await fetch(`https://cardano-${context}.blockfrost.io/api/v0/assets/${policyId}${assetName}`, {
        headers: {
            project_id: blockfrostApiKey,
            'Content-Type': 'application/json'
        }
    }).then((res) => res.json());

    if (data.error) {
        return {
            error: data
        };
    }

    return {
        data
    };
};
