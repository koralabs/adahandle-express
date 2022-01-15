import * as wallet from 'cardano-wallet-js';
import { Firebase } from "../helpers/firebase";
import { fetch } from 'cross-fetch';
import { RefundableSessions } from "../models/firestore/collections/RefundableSessions";
import { config } from 'dotenv';
import { GraphqlCardanoSenderAddressesResult } from "../helpers/graphql";
import { getMintWalletServer } from "../helpers/wallet/cardano";
import { toADA } from '../helpers/utils';
import { getGraphqlEndpoint } from "../helpers/constants";
config();

interface ReturnData { amount: number, returnAddress: string, paymentAddress: string }

const run = async () => {
    await Firebase.init();
    const sessions = await RefundableSessions.getRefundableSessionsByLimit(0);
    const refundWallet = await getMintWalletServer();
    const paymentAddresses = sessions.map(session => session.wallet.address);
    const availableBalance = refundWallet.getTotalBalance();

    const url = getGraphqlEndpoint();
    const res: GraphqlCardanoSenderAddressesResult = await fetch(url, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        variables: {
          addresses: paymentAddresses,
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
              hash
              outputs(
                order_by:{
                  index:asc
                }
              ){
                value
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

    const map: ReturnData[] = [];
    res?.data?.transactions?.forEach(tx => {
      const paymentOutputs = tx.outputs.filter(out => paymentAddresses.includes(out.address));
      if (!paymentOutputs) {
        console.log('No payment output.');
        return;
      }

      const totalAmount = paymentOutputs.reduce((total, out) => parseInt(out.value) + total, 0);
      const matchingSession = sessions.find(session => session.wallet.address === paymentOutputs[0].address);
      const totalSessionAmount = matchingSession?.amount;

      if ( totalSessionAmount && totalSessionAmount !== totalAmount) {
        // console.log({
        //   totalAmount: toADA(totalAmount),
        //   totalSessionAmount: toADA(totalSessionAmount),
        //   // eslint-disable-next-line
        //   // @ts-ignore
        //   hash: tx.hash,
        //   paymentAddress: paymentOutputs[0].address
        // });
      }

      map.push({
        // eslint-disable-next-line
        // @ts-ignore
        hash: tx.hash,
        amount: parseInt(paymentOutputs[0].value),
        returnAddress: tx.inputs[0].address,
        paymentAddress: paymentOutputs[0].address
      });
    });

    const returnAddresses = map.map(data => data.returnAddress);
    const amounts = map.map(data => data.amount);

    console.log(`Current environment: ${RefundableSessions.collectionName}`)
    console.log(`Total sessions: ${sessions.length}. Total amount needed: ${toADA(amounts.reduce((total, curr) => total += curr, 0))}`);
    console.log(`Total amount in wallet: ${toADA(availableBalance)}`);
    if ('true' === process.env.DRYRUN) {
      process.exit();
    }

    if (!returnAddresses || returnAddresses.length !== amounts.length) {
      console.log('No return addresses or they do not match the corresponding amounts.');
      return;
    }

    try {
      const tx = await refundWallet.sendPayment(
        process.env.WALLET_PASSPHRASE,
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
