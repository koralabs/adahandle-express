import * as wallet from "cardano-wallet-js";
import { Firebase } from "../helpers/firebase";
import { AddressWallet, Transaction, TransactionMetadata } from "cardano-wallet-js";
import { getMintingWallet, getPolicyId } from "../helpers/constants";
import { StateData } from "../models/firestore/collections/StateData";
import { getIPFSImage, createNFTImages } from "../helpers/image";
import { getMintWalletServer, getWalletServer } from "../helpers/wallet/cardano";
import { getNetworkConfig, getPolicyKeyPair, getPolicyScript, consolidateChanges } from "../helpers/wallet/minting";

const mint = async (handle: string, returnWalletId: string, burnit: boolean = false) => {
    await Firebase.init();

    console.log("Finding minting wallet");
    const availableWallet = await StateData.findAvailableMintingWallet();

    if (!availableWallet) {
        throw new Error("No minting wallet found.");
    }
    const networkConfig = getNetworkConfig();
    // Wallets.
    const { walletId, seedPhrase } = getMintingWallet(availableWallet.index);
    const ourWallet = await getMintWalletServer(walletId);

    // Purchase data.
    const returnWallet = new AddressWallet(returnWalletId);

    // Policy data.
    const policyId = getPolicyId();
    const keyPair = getPolicyKeyPair();
    const script = getPolicyScript();

    // Build the assets and assign to tokens.
    const asset = new wallet.AssetWallet(policyId, handle, 1);
    const token = new wallet.TokenWallet(asset, script, [keyPair]);
    const amount = wallet.Seed.getMinUtxoValueWithAssets([asset], networkConfig);

    //await createNFTImages([handle]);

    let ipfs: string;
    //ipfs = await getIPFSImage(handle);
    //ipfs = "QmcoGbJYFne2DmfhGg7BkJzAfFNcwfAFiqoW742ULAGAeR"; //<-- $xar5
    ipfs = "QmeAMrXDPfgppjfHZwxvFpS52TdhXk8ebjTzgTLhd96b8z"; //<-- $yeezy4sheezy9

    const nftMetadata = {
        name: `$${handle}`,
        description: "The Handle Standard",
        website: "https://adahandle.com",
        image: `ipfs://${ipfs}`,
        core: {
            og: "",
            termsofuse: "https://adahandle.com/tou",
            handleEncoding: "utf-8",
            prefix: "$",
            version: 0
        },
        augmentations: []
    };

    // Setup our metadata JSON object.
    let data: {} | null = null;

    if (!burnit) {
        let mint_data = {};
        mint_data[handle] = nftMetadata;
        data = {
            "721": {
                [policyId]: mint_data
            }
        };
    }

    // Get coin selection structure (without the assets).
    let coinSelection;
    if (burnit) {
        let coin_assets = {};
        coin_assets[returnWallet.id] = [asset];
        coinSelection = await ourWallet.getCoinSelection([returnWallet], [amount], data, coin_assets);
    } else {
        coinSelection = await ourWallet.getCoinSelection([returnWallet], [amount], data);
    }
    console.log(coinSelection);

    if (!coinSelection) {
        throw new Error("Coin selection was not returned from wallet.");
    }

    // Add signing keys.
    const rootKey = wallet.Seed.deriveRootKey(seedPhrase);
    const signingKeys = coinSelection.inputs.map((i) => {
        return wallet.Seed.deriveKey(rootKey, i.derivation_path).to_raw_key();
    });

    // Add policy signing keys.
    signingKeys.push(...token.scriptKeyPairs!.map((k) => k.privateKey.to_raw_key()));

    /**
     * The wallet API currently doesn't support including tokens
     * not previously minted, so we need to include it manually.
     */
    if (burnit) {
        coinSelection.outputs = coinSelection.outputs.map((output) => {
            if (output.address === returnWallet.address) {
                output.assets = output.assets?.filter(
                    (a) => a.asset_name != Buffer.from(asset.asset_name).toString("hex")
                );
            }
            return output;
        });
    } else {
        coinSelection.outputs = coinSelection.outputs.map((output) => {
            if (output.address === returnWallet.address) {
                output.assets = [
                    {
                        policy_id: asset.policy_id,
                        asset_name: Buffer.from(asset.asset_name).toString("hex"),
                        quantity: asset.quantity
                    }
                ];
            }
            return output;
        });
    }

    // Consolidate the change output to a single utxo.
    coinSelection.change = consolidateChanges(coinSelection.change);

    // Time to live.
    const walletServer = getWalletServer();
    const info = await walletServer.getNetworkInformation();
    const ttl = info.node_tip.absolute_slot_number + 12000;

    const mint = wallet.Mint.new();
    const mintAssets = wallet.MintAssets.new();
    const quant = burnit
        ? wallet.Int.new_negative(wallet.BigNum.from_str(token.asset.quantity.toString()))
        : wallet.Int.new_i32(token.asset.quantity);
    mintAssets.insert(wallet.AssetName.new(Buffer.from(token.asset.asset_name)), quant);

    const scriptHash = wallet.Seed.getScriptHashFromPolicy(policyId);
    mint.insert(scriptHash, mintAssets);

    // Set mint into tx.
    let metadata: TransactionMetadata | undefined = undefined;
    if (data) {
        metadata = wallet.Seed.buildTransactionMetadata(data);
    }
    let txBody = wallet.Seed.buildTransaction(coinSelection, ttl, { metadata: metadata, config: networkConfig });
    txBody.set_mint(mint);

    // Sign the tx so we can get the real transaction fee.
    let tx = wallet.Seed.sign(txBody, signingKeys, metadata, [token.script as wallet.NativeScript]);

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
    if (data) {
        metadata = wallet.Seed.buildTransactionMetadata(data);
    }
    txBody = wallet.Seed.buildTransaction(coinSelection, ttl, { metadata: metadata, config: networkConfig });
    txBody.set_mint(mint);

    tx = wallet.Seed.sign(txBody, signingKeys, metadata, [token.script as wallet.NativeScript]);
    const signed = Buffer.from(tx.to_bytes()).toString("hex");
    const txId = await walletServer.submitTx(signed);
    console.log(`transaction id is ${txId}`);
};

//mint("burnxartoken1");
//mint("burnxartoken2", "addr_test1qqyqga5dacxl2l70ge05ymgltjnx7h7pkjf9xgxld9mjjksmxrty542ltul7m2sqnejaanfq62scmycncuz2umnqtu9s5x4kse"); // <- Our minting wallet
//mint("burnxartoken2", 'addr_test1qqyqga5dacxl2l70ge05ymgltjnx7h7pkjf9xgxld9mjjksmxrty542ltul7m2sqnejaanfq62scmycncuz2umnqtu9s5x4kse', true);
//mint("burnxartoken2", 'addr_test1qzcqhred0e4zvm4em0yrvqqsezwa27mx39fk2pcp2zafl997pvpj7duk6f254097kfv4lzk8c6u23zwt2uu2k9z0xqvqx4v8nd');  // <- Jesse's Test
