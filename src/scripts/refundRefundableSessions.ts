import * as wallet from 'cardano-wallet-js';
import { Firebase } from "../helpers/firebase";
import { RefundableSessions } from "../models/firestore/collections/RefundableSessions";
import { config } from 'dotenv';
import { lookupReturnAddresses } from "../helpers/graphql";
import { getMintWalletServer } from "../helpers/wallet/cardano";
config();

const run = async () => {
    await Firebase.init();
    const sessions = await RefundableSessions.getRefundableSessions();
    console.log('sessions', sessions);

    const returnAddresses = await lookupReturnAddresses(sessions.map(session => session.wallet.address));

    if (!returnAddresses) {
      console.log('No return addresses.');
      return;
    }

    const amounts = sessions.map(session => session.amount);
    const refundWallet = await getMintWalletServer();

    if (process.env.DRYRUN) {
      console.log(`Total amount needed: ${amounts.reduce((total, curr) => total += curr, 0)})`);
      process.exit();
    }

    await refundWallet.sendPayment(
      'test123test123',
      returnAddresses.map(addr => new wallet.AddressWallet(addr)),
      amounts
    );

    process.exit();
}

run();
