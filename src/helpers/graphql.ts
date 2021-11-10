import { fetch } from 'cross-fetch';
import { getGraphqlEndpoint } from "./constants";
import { getFingerprint } from './utils';

export interface WalletSimplifiedBalance {
  address: string;
  amount: number;
}

interface GraphqlGenesisSettings {
  genesis: {
    shelley: {
      protocolParams: {
        maxTxSize: number;
        minUTxOValue: number;
        minFeeA: number;
        minFeeB: number;
        poolDeposit: number;
        keyDeposit: number;
        maxValSize: number;
      }
    }
  }
}

export interface GraphqlCardanoPaymentAddress {
  address: string;
  summary: {
    assetBalances: {
      quantity: string;
      asset: {
        assetName: string;
      };
    }[];
  };
}

interface GraphqlCardanoPaymentAddressesResult {
  data: {
    paymentAddresses: GraphqlCardanoPaymentAddress[];
  }
}

interface GraphqlCardanoSenderAddress {
  inputs: {
    address: string;
  }[]
}

interface GraphqlCardanoSenderAddressesResult {
  data: {
    transactions: GraphqlCardanoSenderAddress[];
  }
}

interface GraphqlCardanoAssetExistsResult {
  data: {
    assets: [
      {
        assetName: string;
        policyId: string;
        tokenMints_aggregate: {
          aggregate: {
            count: string;
          }
        }
      }
    ]
  }
}

interface GraphqlCardanoReturnAddress {
  address: string;
}

interface GraphqlCardanoSpecifications {
  tip: {
    slotNo: number;
  }
  currentEpoch: {
    protocolParams: {
      maxBlockBodySize: number;
      maxTxSize: number;
    }
  }
}

interface GraphqlResponse {
  data: {
    cardano: GraphqlCardanoSpecifications;
    paymentAddresses: GraphqlCardanoPaymentAddress[];
    genesis: GraphqlGenesisSettings;
  }
}

interface GraphqlPaymentAddressResponse {
  data: {
    address: string;
    summary: {
      assetBalances: {
        quantity: string;
        asset: {
          assetName: string;
        }
      }[]
    }
  }
}

export interface GraphqlHandleExistsResponse {
  policyID?: string;
  assetName?: string;
  exists: boolean;
  duplicate: boolean;
}

export interface LookupResponseBody {
  error: boolean;
  message?: string;
  address: string | null;
  policyId: string | null;
  assetName: string | null;
}

interface AssetMintData {
  policyId: string;
  assetName: string;
  tokenMints: {
    transaction: {
      outputs: {
        address: string,
      }[]
    }
  }[]
}

interface GraphqlLookupResponseBody {
  data: {
    assets: AssetMintData[]
  }
}


export const checkPayments = async (addresses: string[]): Promise<WalletSimplifiedBalance[]> => {
  const url = getGraphqlEndpoint();
  const res: GraphqlCardanoPaymentAddressesResult = await fetch(url, {
    method: 'POST',
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      variables: {
        addresses: addresses,
      },
      query: `
        query ($addresses: [String!]!) {
          paymentAddresses(
            addresses: $addresses
          ) {
            address
            summary{
              assetBalances {
                quantity
                asset {
                  assetName
                }
              }
            }
          }
        }
      `,
    })
  }).then(res => res.json())

  if (!res?.data) {
    throw new Error('Unable to query payment amount.');
  }

  const {
    data: {
      paymentAddresses
    },
  } = res;

  const checkedAddresses = paymentAddresses.map((paymentAddress) => {
    const utxos = paymentAddress?.summary?.assetBalances || null;
    const ada = utxos && utxos.find(({ asset }) => 'ada' === asset.assetName);

    if (!ada) {
      return {
        address: paymentAddress.address,
        amount: 0
      };
    }

    return {
      address: paymentAddress.address,
      amount: parseInt(ada.quantity)
    };
  });

  return checkedAddresses;
}

export const handleExists = async (handle: string): Promise<GraphqlHandleExistsResponse> => {
  const url = getGraphqlEndpoint();

  const fingerprint = getFingerprint(handle);

  const res: GraphqlCardanoAssetExistsResult = await fetch(url, {
    method: 'POST',
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      variables: {
        fingerprint,
      },
      query: `
        query ($fingerprint: String!) {
          assets(
            limit: 1,
            where: {
              fingerprint: {
                _eq: $fingerprint
              }
            }
          ) {
            policyId
            assetName
            tokenMints_aggregate {
              aggregate {
                count
              }
            }
          }
        }
      `,
    })
  }).then(res => res.json())

  if (!res.data || res.data.assets.length < 1) {
    return {
      exists: false,
      duplicate: false
    };
  }

  return {
    exists: true,
    policyID: res.data.assets[0].policyId,
    assetName: res.data.assets[0].assetName,
    duplicate: res.data.assets[0].tokenMints_aggregate.aggregate.count !== '1'
  }
}

export const lookupReturnAddresses = async (
  receiverAddresses: string[]
): Promise<GraphqlCardanoSenderAddress[] | null> => {
  const url = getGraphqlEndpoint();
  const res: GraphqlCardanoSenderAddressesResult = await fetch(url, {
    method: 'POST',
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      variables: {
        addresses: receiverAddresses,
      },
      query: `
        query ($addresses: [String!]!) {
          transactions(
            order_by: {
              blockIndex:desc
            }
            where:{
              outputs:{
                address:{
                  _in: $addresses
                }
              }
            }
          ) {
            inputs(
              limit:1
            ) {
              address
            }
          }
        }
      `,
    })
  }).then(res => res.json())

  console.log('lookupReturnAddresses response:', res);
  if (!res?.data) {
    return null;
  }

  return res.data.transactions;
}

export const lookupLocation = async (
  handle: string
): Promise<AssetMintData[] | false> => {
  const url = getGraphqlEndpoint();

  const fingerprint = getFingerprint(handle);

  const res: GraphqlLookupResponseBody = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      variables: {
        fingerprint,
      },
      query: `
        query ($fingerprint: String!) {
          assets(
            limit:2
            where: {
              fingerprint: {
                _eq: $fingerprint
              }
            }
          ) {
            assetName
            policyId
            tokenMints(
              limit: 2
            ) {
              transaction {
                outputs(
                  limit: 1
                  order_by: {
                    index:asc
                  }
                ) {
                  address
                }
              }
            }
          }
        }
      `,
    }),
  }).then((data) => data.json());

  const {
    data: {
      assets
    }
  } = res;

  if (!assets || !assets.length) {
    return false;
  }

  return assets;
};
