import * as wallet from 'cardano-wallet-js';
import { Firebase } from "../helpers/firebase";
import { RefundableSessions } from "../models/firestore/collections/RefundableSessions";
import { config } from 'dotenv';
import { lookupReturnAddresses } from "../helpers/graphql";
import { getMintWalletServer } from "../helpers/wallet/cardano";
import { toADA } from '../helpers/utils';
config();

const run = async () => {
    await Firebase.init();
    const sessions = await RefundableSessions.getRefundableSessions();
    const refundWallet = await getMintWalletServer();
    const availableBalance = refundWallet.getTotalBalance();
    console.log('Attempting to refund: ', sessions.length);
    console.log(`Total minting wallet balance: ${toADA(availableBalance)}`);
    const amounts = sessions.map(session => session.amount);
    if (process.env.DRYRUN) {
      console.log(`Total amount needed: ${toADA(amounts.reduce((total, curr) => total += curr, 0))}`);
      process.exit();
    }

    const returnAddresses = await lookupReturnAddresses(sessions.map(session => session.wallet.address));

    if (!returnAddresses) {
      console.log('No return addresses.');
      return;
    }

    // await refundWallet.sendPayment(
    //   'test123test123',
    //   returnAddresses.map(addr => new wallet.AddressWallet(addr)),
    //   amounts
    // );

    process.exit();
}

run();
