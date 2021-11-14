import * as wallet from "cardano-wallet-js";

import {
  getPolicyPrivateKey,
  getMintingWalletSeedPhrase,
  getPolicyId
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

export const mintHandlesAndSend = async (sessions: PaidSession[]): Promise<string | void> => {
  const walletServer = getWalletServer();
  const ourWallet = await getMintWalletServer();
  const policyId = getPolicyId();

  const networkConfig =
    process.env.NODE_ENV === "development"
      ? wallet.Config.Testnet
      : wallet.Config.Mainnet;

  const transactions = await lookupReturnAddresses(sessions.map(session => session.wallet.address));
  if (!transactions) {
    throw new Error(
      'Unable to find transactions.'
    );
  }

  const buyerAddresses = transactions.map((tx) => new wallet.AddressWallet(tx.inputs[0].address));
  if (!buyerAddresses) {
    throw new Error(
      `No buyer addresses were found.`
    );
  }

  // Pre-build Handle images.
  const twitterHandles = (await ReservedHandles.getReservedHandles()).twitter;
  const handlesMetadata = Promise.allSettled(sessions.map(async (session) => {
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

    const metadata = {
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
    }

    return metadata;
  }));

  // Setup our metadata JSON object.
  const data = {
    "721": {
      [policyId]: {
        ...sessions.reduce(async (collection, session, index) => {
          const metadata = handlesMetadata[index];
          return {
            ...collection,
            [session.handle]: {
              ...metadata
            }
          }
        }, {}),
      }
    }
  };

  // Get our script signing keypair.
  const policyKey = getPolicyPrivateKey();
  const prvKey = wallet.Bip32PrivateKey.from_bech32(policyKey);
  const keyPair = {
    privateKey: prvKey,
    publicKey: prvKey.to_public(),
  };
  const keyHash = wallet.Seed.getKeyHash(keyPair.publicKey);
  const script = wallet.Seed.buildSingleIssuerScript(keyHash);

  // Build the assets and assign to tokens.
  const assets = sessions.map(session => new wallet.AssetWallet(policyId, session.handle, 1));
  const tokens = assets.map(asset => new wallet.TokenWallet(asset, script, [keyPair]));
  const amounts = assets.map((_asset, index) => wallet.Seed.getMinUtxoValueWithAssets([assets[index]], networkConfig));

  // Get coin selection structure (without the assets).
  Logger.log({ message: `Getting coinselection for: ${JSON.stringify(sessions)}. Corresponding params: ${JSON.stringify({ buyerAddresses, amounts, data })}`, event: 'mintHandlesAndSend.getCoinSelection' });
  const coinSelection = await ourWallet.getCoinSelection(
    buyerAddresses,
    amounts,
    data
  ).catch(e => console.log(e));

  if (!coinSelection) {
    return;
  }

  // Add signing keys.
  const recoveryPhrase = getMintingWalletSeedPhrase();
  const rootKey = wallet.Seed.deriveRootKey(recoveryPhrase);
  const signingKeys = coinSelection.inputs.map((i) => {
    return wallet.Seed.deriveKey(rootKey, i.derivation_path).to_raw_key();
  });

  // Add policy signing keys.
  tokens
    .filter((token) => token.scriptKeyPairs)
    .forEach((token) =>
      signingKeys.push(
        ...token.scriptKeyPairs!.map((k) => k.privateKey.to_raw_key())
      )
    );

  /**
   * The wallet API currently doesn't support including tokens
   * not previously minted, so we need to include it manually.
   */
  coinSelection.outputs = coinSelection.outputs.map((output, index) => {
    if (output.address === buyerAddresses[index].address) {
      output.assets = [{
        policy_id: assets[index].policy_id,
        asset_name: Buffer.from(assets[index].asset_name).toString("hex"),
        quantity: assets[index].quantity,
      }]
    }
    return output;
  });

  /**
   * Consolidate the change output to a single utxo.
   */
  coinSelection.change = coinSelection.change.reduce(
    (
      newChange: wallet.ApiCoinSelectionChange[],
      currChange: wallet.ApiCoinSelectionChange,
      index
    ) => {
      if (index === 0) {
        newChange.push(currChange);
        return newChange;
      } else {
        newChange[0].amount.quantity += currChange.amount.quantity;
      }

      return newChange;
    },
    []
  );

  const info = await walletServer.getNetworkInformation();
  const ttl = info.node_tip.absolute_slot_number + 12000;

  let metadata = wallet.Seed.buildTransactionMetadata(data);

  // create mint token data
  const mint = wallet.Mint.new();
  const mintAssets = wallet.MintAssets.new();
  tokens.forEach(t => {
    mintAssets.insert(wallet.AssetName.new(Buffer.from(t.asset.asset_name)), wallet.Int.new_i32(t.asset.quantity));
  });

  const scriptHash = wallet.Seed.getScriptHashFromPolicy(policyId);
  mint.insert(scriptHash, mintAssets);

  // get token's scripts
  const scripts = tokens.map(t => t.script) as wallet.NativeScript[];

  // set mint into tx
  let txBody = wallet.Seed.buildTransaction(coinSelection, ttl, { metadata: metadata, config: networkConfig });
  txBody.set_mint(mint);

  // tx field fee
  const fieldFee = parseInt(txBody.fee().to_str());

  // sign to calculate the real tx fee;
  let tx = wallet.Seed.sign(txBody, signingKeys, metadata, scripts);

  // Ensure that the real tx fee is updated on change output.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const txFee = parseInt(wallet.Seed.getTransactionFee(tx, networkConfig).to_str());
  const marginFee = txFee - fieldFee;

  // If < 0 the current fee is enough, so we won't burn the dust!
  if (marginFee > 0) {
    const quantity = coinSelection.change[0].amount.quantity;
    coinSelection.change[0].amount.quantity = quantity - marginFee;
  }

  // after signing the metadata is cleaned so we need to create it again
  metadata = wallet.Seed.buildTransactionMetadata(data);
  txBody = wallet.Seed.buildTransaction(coinSelection, ttl, { metadata: metadata, config: networkConfig });
  txBody.set_mint(mint);

  tx = wallet.Seed.sign(txBody, signingKeys, metadata, scripts);
  const signed = Buffer.from(tx.to_bytes()).toString("hex");

  try {
    const txId = await walletServer.submitTx(signed).catch(e => console.log(e));
    return txId;
  } catch(e) {
    Logger.log({ message: JSON.stringify(e), event: 'mintHandleAndSend.submitTx' });
  }
};
