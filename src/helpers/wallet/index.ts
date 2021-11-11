import * as wallet from "cardano-wallet-js";

import {
  getPolicyPrivateKey,
  getMintingWalletSeedPhrase,
  getPolicyId,
  getMintingWalletId
} from "../constants";
import {
  GraphqlCardanoPaymentAddress,
  lookupReturnAddresses,
} from "../graphql";
import { getIPFSImage } from "../image";
import { getMintWalletServer, getWalletServer, NewAddress } from "./cardano";
import { WalletAddresses } from "../../models/firestore/collections/WalletAddresses";
import { ReservedHandles } from "../../models/firestore/collections/ReservedHandles";
import { PaidSession } from "../../models/PaidSession";
import { Logger } from "../Logger";

export const getNewAddress = async (): Promise<NewAddress | false> => {
  const newAddress = await WalletAddresses.getFirstAvailableWalletAddress();

  console.log(newAddress);
  if (!newAddress) {
    console.log("Not able to get new address.");
    return false;
  }

  return {
    address: newAddress.id,
  };
};

export const getAmountsFromPaymentAddresses = (
  paymentAddresses: GraphqlCardanoPaymentAddress[]
): number[] => {
  const balances = paymentAddresses.map((addr) =>
    addr.summary.assetBalances.filter((bal) => "ada" === bal.asset.assetName)
  );

  const totalBalances = balances.map((bal) => parseInt(bal[0].quantity));

  return totalBalances;
};

export const mintHandleAndSend = async (session: PaidSession): Promise<any> => {
  const walletServer = getWalletServer();
  const ourWallet = await getMintWalletServer();

  const networkConfig =
    process.env.NODE_ENV === "development"
      ? wallet.Config.Testnet
      : wallet.Config.Mainnet;

  const transactions = await lookupReturnAddresses([session.wallet.address]);
  const buyerAddress =
    transactions &&
    transactions.map((tx) => new wallet.AddressWallet(tx.inputs[0].address))[0];

  if (!buyerAddress) {
    throw new Error(
      `No input address was found for ${session.wallet.address}.`
    );
  }

  const twitterHandles = (await ReservedHandles.getReservedHandles()).twitter;
  const og = twitterHandles.includes(session.handle);
  const ipfs = await getIPFSImage(
    session.handle,
    og,
    twitterHandles.indexOf(session.handle),
    twitterHandles.length
  );

  // File did not upload, try again.
  if (!ipfs) {
    return false;
  }

  const policyId = getPolicyId();

  const data = {
    "721": {
      [policyId]: {
        [session.handle]: {
          name: `$${session.handle}`,
          description: "https://adahandle.com",
          image: `ipfs://${ipfs.hash}`,
          core: {
            og: +og,
            termsofuse: "https://adahandle.com/tou",
            handleEncoding: "utf-8",
            version: 0,
          },
          augmentations: [],
        },
      },
    }
  };

  const supply = 1;

  // Get script signing keypair.
  const policyKey = getPolicyPrivateKey();
  const prvKey = wallet.Bip32PrivateKey.from_bech32(policyKey);
  const keyPair = {
    privateKey: prvKey,
    publicKey: prvKey.to_public(),
  };
  const keyHash = wallet.Seed.getKeyHash(keyPair.publicKey);
  const script = wallet.Seed.buildSingleIssuerScript(keyHash);
  const scripts = [script];

  // Asset.
  const asset = new wallet.AssetWallet(policyId, session.handle, supply);
  const tokens = [new wallet.TokenWallet(asset, script, [keyPair])];

  // Get minimum ADA for address holding tokens.
  const minAda = wallet.Seed.getMinUtxoValueWithAssets([asset], networkConfig);
  const addresses = [buyerAddress];
  const amounts = [minAda];

  // Get coin selection structure (without the assets).
  const coinSelection = await ourWallet.getCoinSelection(
    addresses,
    amounts,
    data
  );

  // Add signing keys.
  const recoveryPhrase = getMintingWalletSeedPhrase();
  const rootKey = wallet.Seed.deriveRootKey(recoveryPhrase);
  const signingKeys = coinSelection.inputs.map((i) => {
    return wallet.Seed.deriveKey(rootKey, i.derivation_path).to_raw_key();
  });

  // Add policy signing keys.
  tokens
    .filter((t) => t.scriptKeyPairs)
    .forEach((t) =>
      signingKeys.push(
        ...t.scriptKeyPairs!.map((k) => k.privateKey.to_raw_key())
      )
    );

  const metadata = wallet.Seed.buildTransactionMetadata(data);

  /**
   * The wallet API currently doesn't support including tokens
   * not previously minted, so we need to include it manually.
   */
  coinSelection.outputs = coinSelection.outputs.map((output) => {
    if (output.address === addresses[0].address) {
      output.assets = tokens.map((t) => {
        const asset = {
          policy_id: t.asset.policy_id,
          asset_name: Buffer.from(t.asset.asset_name).toString("hex"),
          quantity: t.asset.quantity,
        };
        return asset;
      });
    }
    return output;
  });

  const info = await walletServer.getNetworkInformation();
  // Test a GIANT NUMBER
  const ttl = 10000000000000000000000000000000000000000000000000000000000000000000000000000000;

  try {
    const txBody = wallet.Seed.buildTransactionWithToken(
      coinSelection,
      ttl,
      tokens,
      signingKeys,
      {
        data: data,
        startSlot: info.network_tip?.slot_number || 0,
        config: networkConfig,
      }
    );

    const tx = wallet.Seed.sign(txBody, signingKeys, metadata, scripts);
    const signed = Buffer.from(tx.to_bytes()).toString("hex");
    const txId = await walletServer.submitTx(signed);
    if (txId) {
      console.log(`Minted! Transaction ID: ${txId}`);
      return txId;
    }

    return false;
  } catch (e) {
    throw new Error(e as any);
  }
};
