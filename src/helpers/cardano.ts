import { fetch } from 'cross-fetch';
import { getGraphqlEndpoint, getPolicyId, getPolicyPrivateKey } from "./constants";
import { LogCategory, Logger } from "../helpers/Logger";

export const getTotalHandles = async (): Promise<null | number> => {
  const policyId = getPolicyId();
  const res = await fetch(
    getGraphqlEndpoint(),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        variables: {
          policyID: policyId
        },
        query: `
          query ($policyID: Hash28Hex!) {
            assets_aggregate (
              where:{
                policyId: {
                  _eq: $policyID
                }
              }
            ) {
              aggregate {
                count
              }
            }
          }
        `,
      }),
    }
  )
    .then((res) => res.json())
    .catch((e) => Logger.log({ message: JSON.stringify(e), category: LogCategory.ERROR }));

  try {
    const {
      assets_aggregate: {
        aggregate: {
          count
        }
      },
      // eslint-disable-next-line no-unsafe-optional-chaining
    } = res?.data;

    return parseInt(count);
  } catch (e) {
    Logger.log({ message: JSON.stringify(e), category: LogCategory.ERROR });
    return null;
  }
}

export const getChainLoad = async (): Promise<null | number> => {
  const res = await fetch(
    getGraphqlEndpoint(),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `
          query {
            cardano {
              currentEpoch {
                protocolParams {
                  maxBlockBodySize
                }
              }
            }
            blocks_aggregate(limit: 20, order_by: { forgedAt: desc }) {
              aggregate {
                avg {
                  size
                }
              }
            }
          }
        `,
      }),
    }
  )
    .then((res) => res.json())
    .catch((e) => Logger.log({ message: JSON.stringify(e), category: LogCategory.ERROR }));

  try {
    const {
      cardano: {
        currentEpoch: {
          protocolParams: { maxBlockBodySize },
        },
      },
      blocks_aggregate: {
        aggregate: {
          avg: { size },
        },
      },
      // eslint-disable-next-line no-unsafe-optional-chaining
    } = res?.data;

    const load = Math.floor(size) / Math.floor(maxBlockBodySize);
    return load;
  } catch (e) {
    Logger.log({ message: JSON.stringify(e), category: LogCategory.ERROR });
    return null;
  }
};
