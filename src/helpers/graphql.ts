import { fetch } from "cross-fetch";
import { getGraphqlEndpoint, getPolicyId } from "./constants";
import { LogCategory, Logger } from "./Logger";
import { getFingerprint } from "./utils";

export interface WalletSimplifiedBalance {
    address: string;
    amount: number;
    txHash?: string;
    index?: number;
    paymentAddress?: string;
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
            };
        };
    };
}

interface GraphqlCardanoPaymentAddressesResult {
    data: {
        paymentAddresses: GraphqlCardanoPaymentAddress[];
    };
}

export interface GraphqlCardanoSenderAddress {
    inputs: {
        address: string;
    }[];
    outputs: {
        address: string;
        index: number;
        txHash: string;
        value?: string;
    }[];
}

interface GraphqlCardanoSenderAddressesResult {
    data: {
        transactions: GraphqlCardanoSenderAddress[];
    };
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
                    };
                };
            }
        ];
    };
}

export interface StakePoolDetails {
    url: string;
    id: string;
    rewardAddress: string;
    owners: { hash: string }[];
}

interface GraphqlStakePoolsResult {
    data: {
        stakePools: StakePoolDetails[];
    };
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
                address: string;
            }[];
        };
    }[];
}

interface GraphqlLookupResponseBody {
    data: {
        assets: AssetMintData[];
    };
}

interface Transaction {
    hash: string;
    includedAt: string;
}

export const checkPayments = async (addresses: string[]): Promise<WalletSimplifiedBalance[]> => {
    const url = getGraphqlEndpoint();
    const res: GraphqlCardanoPaymentAddressesResult = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            variables: {
                addresses: addresses
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
            `
        })
    }).then((res) => res.json());

    if (!res?.data) {
        throw new Error("Unable to query payment amount.");
    }

    const {
        data: { paymentAddresses }
    } = res;

    const checkedAddresses = paymentAddresses.map((payment) => {
        const utxos = payment?.summary?.assetBalances || null;
        const ada = utxos && utxos.find(({ asset }) => "ada" === asset.assetName);

        const paymentAddress = payment.address;

        if (!ada) {
            return {
                address: "",
                amount: 0,
                paymentAddress
            } as WalletSimplifiedBalance;
        }

        return {
            address: "",
            amount: parseInt(ada.quantity),
            paymentAddress
        } as WalletSimplifiedBalance;
    });

    const addressesWithPayments = checkedAddresses
        .filter((address) => address.amount && address.amount > 0)
        .map(({ paymentAddress = "", amount }) => ({ paymentAddress, amount }));
    const returnAddressesMap = await lookupReturnAddresses(addressesWithPayments);

    const checkedAddressesWithReturnAddresses = checkedAddresses.map((item) => {
        const returnAddress = returnAddressesMap.get(item.paymentAddress as string);
        if (returnAddress) {
            return {
                ...item,
                address: returnAddress.address,
                txHash: returnAddress.txHash,
                index: returnAddress.index
            } as WalletSimplifiedBalance;
        }

        return item;
    });

    return checkedAddressesWithReturnAddresses;
};

export const handleExists = async (handle: string): Promise<GraphqlHandleExistsResponse> => {
    const url = getGraphqlEndpoint();

    const fingerprint = getFingerprint(handle);

    const res: GraphqlCardanoAssetExistsResult = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            variables: {
                fingerprint
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
            `
        })
    }).then((res) => res.json());

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
        duplicate: res.data.assets[0].tokenMints_aggregate.aggregate.count !== "1"
    };
};

export const lookupReturnAddresses = async (
    receiverAddresses: {
        paymentAddress: string;
        amount: number;
    }[]
): Promise<Map<string, WalletSimplifiedBalance>> => {
    const url = getGraphqlEndpoint();
    const res: GraphqlCardanoSenderAddressesResult = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            variables: {
                addresses: receiverAddresses.map(({ paymentAddress }) => paymentAddress)
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
            `
        })
    }).then((res) => res.json());

    if (!res?.data) {
        Logger.log({
            message: "No data from lookupReturnAddresses",
            event: "lookupReturnAddresses.noData",
            category: LogCategory.ERROR
        });
        return new Map();
    }

    const orderedTransactions = receiverAddresses.reduce<Map<string, WalletSimplifiedBalance>>(
        (agg, { paymentAddress, amount }) => {
            const transaction = res.data.transactions.find((tx) =>
                tx.outputs.some((output) => output.address === paymentAddress)
            );
            if (transaction) {
                const paymentOutput = transaction.outputs.find((out) => out.address === paymentAddress);
                if (paymentOutput) {
                    agg.set(paymentAddress, {
                        address: transaction.inputs[0].address,
                        txHash: paymentOutput.txHash,
                        index: paymentOutput.index,
                        paymentAddress,
                        amount
                    });
                    return agg;
                }
            }

            Logger.log({
                message: `Unable to find transaction for address: ${paymentAddress}`,
                event: "lookupReturnAddresses.noTransaction",
                category: LogCategory.INFO
            });
            return agg;
        },
        new Map()
    );

    return orderedTransactions;
};

export const lookupTransaction = async (
    address: string
): Promise<{
    totalPayments: number;
    returnAddress?: string;
    txHash?: string;
    index?: number;
}> => {
    const url = getGraphqlEndpoint();
    const res: GraphqlCardanoSenderAddressesResult = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            variables: {
                address
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
                    txHash
                    index
                  }

                  inputs(
                    limit:1,
                  ) {
                    address
                  }
                }
              }
            `
        })
    }).then((res) => res.json());

    let totalPayments = 0;
    let returnAddress, txHash, index;
    res?.data?.transactions?.forEach((t) => {
        const outputSum = t.outputs.reduce((acc, output) => {
            if (output.address === address && output.value) {
                txHash = output.txHash;
                index = output.index;
                return acc + parseFloat(output.value);
            }

            return acc;
        }, 0);

        totalPayments += outputSum;

        const returnInput = t.inputs.find((input) => input.address != address);
        if (returnInput) {
            returnAddress = returnInput.address;
        }
    });

    return {
        totalPayments,
        returnAddress,
        txHash,
        index
    };
};

export const lookupLocation = async (handle: string): Promise<AssetMintData[] | false> => {
    const url = getGraphqlEndpoint();

    const fingerprint = getFingerprint(handle);

    const res: GraphqlLookupResponseBody = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            variables: {
                fingerprint
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
            `
        })
    }).then((data) => data.json());

    const {
        data: { assets }
    } = res;

    if (!assets || !assets.length) {
        return false;
    }

    return assets;
};

export const getCurrentSlotNumberFromTip = async (): Promise<number> => {
    const url = getGraphqlEndpoint();
    const res: GraphqlCardanoSlotNumberResult = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
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
            `
        })
    }).then((res) => res.json());

    if (!res?.data) {
        throw new Error("Unable to query current slot number.");
    }

    const {
        cardano: {
            tip: { slotNo }
        }
    } = res.data;

    return slotNo;
};

export const getStakePoolsById = async (addresses: string[]): Promise<StakePoolDetails[]> => {
    const url = getGraphqlEndpoint();
    console.log(url);
    const res: GraphqlStakePoolsResult = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            variables: {
                addresses
            },
            query: `
              query ($addresses: [StakePoolID]!) {
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
              }
            `
        })
    }).then((res) => res.json());

    if (!res?.data) {
        console.log("res", res);
        throw new Error("Unable to query stake pools.");
    }

    const { stakePools } = res.data;

    return stakePools;
};

export const hasDoubleMint = async (): Promise<boolean> => {
    const url = getGraphqlEndpoint();
    const res: { data: { assets: unknown[] } } = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            query: `
              query {
                assets(where:{
                  policyId:{
                    _eq:"${getPolicyId()}"
                  }
                  tokenMints:{
                    quantity:{
                      _gt:"1"
                    }
                  }
                }) {
                  fingerprint
                }
              }
            `
        })
    }).then((res) => res.json());

    if (!res?.data) {
        throw new Error("Unable to query double mint.");
    }

    const { assets } = res.data;

    return assets.length > 0;
};

export const getTransactionsByHashes = async (hashes: string[]): Promise<Transaction[]> => {
    const url = getGraphqlEndpoint();
    const res: { data: { transactions: Transaction[] } } = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            variables: {
                hashes
            },
            query: `
              query ($hashes: [Hash32Hex]) {
                transactions(where: {hash: {_in: $hashes}}) {
                  hash
                  includedAt
                }
              }
            `
        })
    }).then((res) => res.json());

    if (!res?.data) {
        throw new Error("Unable to query transactions.");
    }

    const { transactions } = res.data;

    return transactions;
};
