import fetch from 'cross-fetch';
import * as cardanoAddresses from 'cardano-addresses';
import { getBlockfrostApiKey, getPolicyId, isProduction } from "../helpers/constants";
import { isValidShellyAddress } from '../express/handlers/lookupAddress';

const run = async () => {
    const handle = '07';

    const context = isProduction() ? 'mainnet' : 'testnet';
    const policyId = getPolicyId();
    const blockfrostApiKey = getBlockfrostApiKey();

    console.log(context, policyId, blockfrostApiKey);

    const assetName = Buffer.from(handle).toString('hex');
    const url = `https://cardano-${context}.blockfrost.io/api/v0/assets/${policyId}${assetName}/addresses`;
    console.log('url', url);

    const data = await fetch(url,
        {
            headers: {
                project_id: blockfrostApiKey,
                'Content-Type': 'application/json'
            }
        }
    ).then(res => res.json());

    console.log('data', data);

    const [result] = data;

    console.log(result);

    const addressDetails = await cardanoAddresses.inspectAddress(result.address);

    console.log('results', {
        error: false,
        isShellyAddress: isValidShellyAddress(addressDetails.address_type),
        assetName,
        address: result.address,
        addressType: addressDetails.address_type
    });

    process.exit();
}

run();