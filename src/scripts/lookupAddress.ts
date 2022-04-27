import fetch from 'cross-fetch';
import * as cardanoAddresses from 'cardano-addresses';
import { getBlockfrostApiKey, getPolicyId, isProduction } from "../helpers/constants";

const run = async () => {
    const handle = 'bigirishlion';

    const context = isProduction() ? 'mainnet' : 'testnet';
    const policyId = getPolicyId();
    const blockfrostApiKey = getBlockfrostApiKey();

    console.log(context, policyId, blockfrostApiKey);

    const assetName = Buffer.from(handle).toString('hex');
    const data = await fetch(
        `https://cardano-${context}.blockfrost.io/api/v0/assets/${policyId}${assetName}/addresses`,
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

    return console.log('results', {
        error: false,
        isShellyAddress: addressDetails.address_type === 0,
        assetName,
        address: result.address,
    });
}

run();