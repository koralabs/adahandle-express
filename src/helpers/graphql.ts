import { fetch } from 'cross-fetch';
import { getGraphqlEndpoint } from "./constants";
import { getFingerprint } from './utils';

export interface WalletSimplifiedBalance {
  address: string;
  amount: number;
  returnAddress: string;
  txHash: string;
  index: number;
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

interface GraphqlCardanoSlotNumberResult {
  data: {
    cardano: {
      tip: {
        slotNo: number;
      }
    }
  }
}

interface GraphqlCardanoPaymentAddressesResult {
  data: {
    paymentAddresses: GraphqlCardanoPaymentAddress[];
  }
}

export interface GraphqlCardanoSenderAddress {
  inputs: {
    address: string;
  }[],
  outputs: {
    address: string;
    index: number;
    txHash: string;
    value?: string;
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

export interface StakePoolDetails {
  url: string;
  id: string;
  rewardAddress: string;
  owners: { hash: string }[];
}

interface GraphqlStakePoolsResult {
  data: {
    stakePools: StakePoolDetails[]
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
        amount: 0,
        returnAddress: ''
      } as WalletSimplifiedBalance;
    }

    return {
      address: paymentAddress.address,
      amount: parseInt(ada.quantity),
      returnAddress: ''
    } as WalletSimplifiedBalance;
  });

  const addressesWithPayments = checkedAddresses.filter(address => address.amount > 0)
  const returnAddresses = await lookupReturnAddresses(addressesWithPayments.map(address => address.address));
  if (returnAddresses) {
    addressesWithPayments.forEach((address, index) => {
      address.returnAddress = returnAddresses[index].returnAddress;
      address.index = returnAddresses[index].index;
      address.txHash = returnAddresses[index].txHash;
    });
  }

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
): Promise<WalletSimplifiedBalance[] | null> => {
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
            where:{
              outputs:{
                address:{
                  _in: $addresses
                }
              }
            }
          ) {
            includedAt
            outputs(
              order_by:{
                index:asc
              }
            ){
              index
              txHash
              address
            }

            inputs(
              limit:1,
            ) {
              address
            }
          }
        }
      `,
    })
  }).then(res => res.json())

  if (!res?.data) {
    return null;
  }

  // TODO: check includedAt to make sure valid transaction
  // TODO: include txHash and index into receiver address object (for manual refunding)

  const map = new Map(res.data.transactions.map(tx => {
    // Remove the payment address from output to avoid sending back to ourselves!
    const cleanedOutputs = tx.outputs.filter(output => output.address !== tx.inputs[0].address);
    return [cleanedOutputs[0].address, {returnAddress: tx.inputs[0].address, txHash: cleanedOutputs[0].txHash, index: cleanedOutputs[0].index}];
  }));
  const orderedTransactions = receiverAddresses.map((addr) => map.get(addr)) as WalletSimplifiedBalance[];
  return orderedTransactions;
}

export const lookupTransaction = async (
  address: string
): Promise<{
  totalPayments: number;
  returnAddress?: string;
}> => {
  const url = getGraphqlEndpoint();
  const res: GraphqlCardanoSenderAddressesResult = await fetch(url, {
    method: 'POST',
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      variables: {
        address,
      },
      query: `
        query ($address: String!) {
          transactions(
            where:{
              outputs:{
                address:{
                  _eq: $address
                }
              }
            }
          ) {
            includedAt
            outputs(
              order_by:{
                index:asc
              }
            ){
              address
              value
            }

            inputs(
              limit:1,
            ) {
              address
            }
          }
        }
      `,
    })
  }).then(res => res.json())

  let totalPayments = 0
  let returnAddress;
  res?.data?.transactions?.forEach(t => {
    const outputSum = t.outputs.reduce((acc, output) => {
      if (output.address === address && output.value) {
        return acc + parseFloat(output.value);
      }

      return acc;
    }, 0);

    totalPayments += outputSum;

    const returnInput = t.inputs.find(input => input.address != address);
    if (returnInput) {
      returnAddress = returnInput.address;
    }
  });

  return {
    totalPayments,
    returnAddress
  };
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

export const getCurrentSlotNumberFromTip = async (): Promise<number> => {
  const url = getGraphqlEndpoint();
  const res: GraphqlCardanoSlotNumberResult = await fetch(url, {
    method: 'POST',
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `
        query {
          cardano {
            tip {
              slotNo
            }
          }
        }
      `,
    })
  }).then(res => res.json())

  if (!res?.data) {
    throw new Error('Unable to query current slot number.');
  }

  const {
    cardano: {
      tip: {
        slotNo
      }
    }
  } = res.data;

  return slotNo;
}

export const getStakePoolsById = async (addresses: string[]): Promise<StakePoolDetails[]> => {
  const url = getGraphqlEndpoint();
  const res: GraphqlStakePoolsResult = await fetch(url, {
    method: 'POST',
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      variables: {
        addresses,
      },
      query: `
      query ($addresses: [String!]!) {
        stakePools(where: {
            id: {
              _in: $addresses
            }
          }) {
          url
          id
          rewardAddress
          owners {
            hash
          }
        }
      `,
    })
  }).then(res => res.json())

  if (!res?.data) {
    throw new Error('Unable to query stake pools.');
  }

  const {
    stakePools
  } = res.data;

  return stakePools;
}
