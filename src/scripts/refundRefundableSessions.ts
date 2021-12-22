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
    const sessions = await RefundableSessions.getRefundableSessionsByLimit(100);
    const refundWallet = await getMintWalletServer();
    const availableBalance = refundWallet.getTotalBalance();
    console.log('Attempting to refund: ', sessions.length);
    console.log(`Total minting wallet balance: ${toADA(availableBalance)}`);
    const amounts = sessions.map(session => session.amount);
    if ('true' === process.env.DRYRUN) {
      console.log(`Current environment: ${RefundableSessions.collectionName}`)
      console.log(`Total amount needed: ${toADA(amounts.reduce((total, curr) => total += curr, 0))}`);
      process.exit();
    }

    const returnAddresses = await lookupReturnAddresses(sessions.map(session => session.wallet.address));

    if (!returnAddresses) {
      console.log('No return addresses.');
      return;
    }

    // First time use to update entries.
    // const updated = await RefundableSessions.updateRefundableSessions(sessions, '', 'pending');
    // console.log(updated);
    console.log(`Refunding: ${JSON.stringify(sessions)}`);

    try {
      const tx = await refundWallet.sendPayment(
        'test123test123',
        returnAddresses.map(addr => new wallet.AddressWallet(addr)),
        amounts
      );

      if (tx.id) {
        await RefundableSessions.updateRefundableSessions(sessions, tx.id, 'submitted');
        console.log(tx.id);
      }
    } catch (e) {
      console.log(e);
    }

    process.exit();
}

run();
