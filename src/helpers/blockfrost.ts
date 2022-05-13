import { getBlockfrostApiKey, getPolicyId, isProduction } from "./constants";

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

export const fetchAssetsAddresses = async (handle: string): Promise<FetchAssetsAddressesResult> => {
    const context = isProduction() ? 'mainnet' : 'testnet';
    const policyId = getPolicyId();
    const blockfrostApiKey = getBlockfrostApiKey();

    const assetName = Buffer.from(handle).toString('hex');
    const data: BlockFrostAssetsAddressesErrorResultBody | BlockFrostAssetsAddressesResultBody[] = await fetch(
        `https://cardano-${context}.blockfrost.io/api/v0/assets/${policyId}${assetName}/addresses`,
        {
            headers: {
                project_id: blockfrostApiKey,
                'Content-Type': 'application/json'
            }
        }
    ).then(res => res.json());

    if (Array.isArray(data)) {
        const [result] = data;

        return {
            address: result.address,
        }
    }

    return {
        errorMessage: data.error,
        statusCode: data.status_code
    }
}