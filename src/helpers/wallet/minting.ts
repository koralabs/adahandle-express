import * as wallet from 'cardano-wallet-js';
import { ReservedHandles } from '../../models/firestore/collections/ReservedHandles';

import { PaidSession } from "../../models/PaidSession";
import { getMintingWalletSeedPhrase, getPolicyId, getPolicyPrivateKey } from '../constants';
import { GraphqlCardanoSenderAddress, lookupReturnAddresses } from "../graphql";
import { getIPFSImage } from '../image';
import { LogCategory, Logger } from '../Logger';
import { getMintWalletServer, getWalletServer } from './cardano';

export const getTransactionsFromPaidSessions = async (sessions: PaidSession[]): Promise<GraphqlCardanoSenderAddress[]> => {
  const transactions = await lookupReturnAddresses(sessions.map(session => session.wallet.address));
  if (!transactions || transactions.length < 1) {
    throw new Error(
      'Unable to find transactions.'
    );
  }

  return transactions;
}

export const getAddressWalletsFromTransactions = async (txs: GraphqlCardanoSenderAddress[]): Promise<wallet.AddressWallet[]> => {
  return txs.map((tx, index) => {
    const inputAddress = tx.inputs[0]?.address;

    if (!inputAddress) {
      Logger.log({ message: `No input address found at index ${index} from ${JSON.stringify(txs)}`, event: 'getAddressWalletsFromTransactions', category: LogCategory.ERROR });
      throw new Error(
        'No input address was found!'
      );
    }

    return new wallet.AddressWallet(inputAddress);
  });
}

export const getNetworkConfig = () => {
  const networkConfig =
    process.env.NODE_ENV === "development"
      ? wallet.Config.Testnet
      : wallet.Config.Mainnet;

  return networkConfig;
}

export const getPolicyKeyPair = () => {
  const policyKey = getPolicyPrivateKey();
  const prvKey = wallet.Bip32PrivateKey.from_bech32(policyKey);
  const keyPair = {
    privateKey: prvKey,
    publicKey: prvKey.to_public(),
  };
  return keyPair;
}

export const getPolicyScript = () => {
  const keyPair = getPolicyKeyPair();
  const keyHash = wallet.Seed.getKeyHash(keyPair.publicKey);
  const script = wallet.Seed.buildSingleIssuerScript(keyHash);
  return script;
}

export const generateMetadataFromPaidSessions = async (sessions: PaidSession[]): Promise<Record<string, unknown>> => {
  Logger.log({ message: `Generating metadata for ${sessions.length} Handles.`, event: 'mintHandlesAndSend' });

  const policyId = getPolicyId();
  const twitterHandles = (await ReservedHandles.getReservedHandles()).twitter;
  const handlesMetadata = await Promise.all(
    sessions.map(async (session) => {
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
        name: `ADA Handle`,
        description: "The Handle Standard",
        website: "https://adahandle.com",
        image: `ipfs://${ipfs}`,
        core: {
          og: +og,
          termsofuse: "https://adahandle.com/tou",
          handleEncoding: "utf-8",
          prefix: '$',
          version: 0,
        },
        augmentations: [],
      }

      return metadata;
    })
  );

  // Setup our metadata JSON object.
  const data = {
    "721": {
      [policyId]: {
        ...sessions.reduce((groupData, session, index) => {
          groupData[session.handle] = handlesMetadata[index];
          return groupData;
        }, {}),
      }
    }
  };

  return data;
}

export const buildTransactionFromPaidSessions = async (sessions: PaidSession[]) => {
  const networkConfig = getNetworkConfig();

  // Wallets.
  const walletServer = getWalletServer();
  const ourWallet = await getMintWalletServer();

  // Purchase data.
  const transactions = await getTransactionsFromPaidSessions(sessions);
  const returnWallets = await getAddressWalletsFromTransactions(transactions);

  // Policy data.
  const policyId = getPolicyId();
  const keyPair = getPolicyKeyPair();
  const script = getPolicyScript();

  // Build the assets and assign to tokens.
  const assets = sessions.map(session => new wallet.AssetWallet(policyId, session.handle, 1));
  const tokens = assets.map(asset => new wallet.TokenWallet(asset, script, [keyPair]));
  const amounts = assets.map((_asset, index) => wallet.Seed.getMinUtxoValueWithAssets([assets[index]], networkConfig));
  const data = await generateMetadataFromPaidSessions(sessions);

  // Get coin selection structure (without the assets).
  const coinSelection = await ourWallet.getCoinSelection(
    returnWallets,
    amounts,
    data
  ).catch(e => {
    Logger.log({ message: JSON.stringify(e), event: 'mintHandlesAndSend.getCoinSelection', category: LogCategory.ERROR });
  });

  if (!coinSelection) {
    throw new Error(
      'Coin selection was not returned from wallet.'
    );
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
    if (output.address === returnWallets[index].address) {
      output.assets = [{
        policy_id: assets[index].policy_id,
        asset_name: Buffer.from(assets[index].asset_name).toString("hex"),
        quantity: assets[index].quantity,
      }]
    }
    return output;
  });

  // Consolidate the change output to a single utxo.
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

  // Time to live.
  const info = await walletServer.getNetworkInformation();
  const ttl = info.node_tip.absolute_slot_number + 12000;

  const mint = wallet.Mint.new();
  const mintAssets = wallet.MintAssets.new();
  tokens.forEach(t => {
    mintAssets.insert(wallet.AssetName.new(Buffer.from(t.asset.asset_name)), wallet.Int.new_i32(t.asset.quantity));
  });

  const scriptHash = wallet.Seed.getScriptHashFromPolicy(policyId);
  mint.insert(scriptHash, mintAssets);

  // Get token's scripts.
  const scripts = tokens.map(t => t.script) as wallet.NativeScript[];

  // Set mint into tx.
  let metadata = wallet.Seed.buildTransactionMetadata(data);
  let txBody = wallet.Seed.buildTransaction(coinSelection, ttl, { metadata: metadata, config: networkConfig });
  txBody.set_mint(mint);

  // Sign the tx so we can get the real transaction fee.
  let tx = wallet.Seed.sign(txBody, signingKeys, metadata, scripts);

  // Ensure that the real tx fee is updated on change output.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const txFee = parseInt(wallet.Seed.getTransactionFee(tx, networkConfig).to_str());
  const fieldFee = parseInt(txBody.fee().to_str());
  const marginFee = txFee - fieldFee;

  // If the marginFee is less or equal to 0, we have enough set aside.
  if (marginFee > 0) {
    const quantity = coinSelection.change[0].amount.quantity;
    coinSelection.change[0].amount.quantity = quantity - marginFee;
  }

  // After signing the metadata is cleaned so we need to create it again.
  metadata = wallet.Seed.buildTransactionMetadata(data);
  txBody = wallet.Seed.buildTransaction(coinSelection, ttl, { metadata: metadata, config: networkConfig });
  txBody.set_mint(mint);

  tx = wallet.Seed.sign(txBody, signingKeys, metadata, scripts);
  const signed = Buffer.from(tx.to_bytes()).toString("hex");
  return signed;
}
