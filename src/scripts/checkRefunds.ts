import { handleRefunds } from '../express/handlers/jobs/refunds';
import { Refund } from '../express/handlers/jobs/refunds/processRefunds';
import { verifyRefund } from '../express/handlers/jobs/refunds/verifyRefund';
import { getRefundWalletId } from '../helpers/constants';
import { Firebase } from '../helpers/firebase';
import { awaitForEach, delay } from '../helpers/utils';
import { getMintWalletServer } from '../helpers/wallet/cardano';
import { UsedAddresses } from '../models/firestore/collections/UsedAddresses';
import { UsedAddressStatus } from '../models/UsedAddress';

export const refundDryRun = async () => {
    await Firebase.init();
    // get used addresses
    const usedAddresses = await UsedAddresses.getRefundableAddresses(0);
    console.log('usedAddresses length', usedAddresses.length);

    // process.exit();

    await delay(5000);

    // iterate through and process
    const verifiedRefunds: Refund[] = [];
    await awaitForEach(usedAddresses, async (usedAddress) => {
        const result = await verifyRefund(usedAddress.id);
        if (result) {
            const { refund, status } = result;
            if (refund) {
                verifiedRefunds.push(refund);
                console.log(`refunding ${usedAddress.id} for ${refund.returnAddress.amount / 1000000}`);
                console.log(`CURRENT ADA SUM: ${verifiedRefunds.reduce((acc, curr) => acc + curr.returnAddress.amount, 0) / 1000000}`);
                return;
            } else if (status) {
                await UsedAddresses.updateUsedAddressStatus(usedAddress.id, status);
                console.log(`${usedAddress.id} status updated to ${status}`);
                return;
            }
        }

        console.log(`No result found for ${usedAddress.id}`);
    });

    // get sum of all verified refunds
    const sum = verifiedRefunds.reduce((acc, curr) => acc + curr.returnAddress.amount, 0);
    console.log(`ADA SUM: ${sum / 1000000}`);
    process.exit()
}

const checkWalletBalance = async () => {
    const walletId = getRefundWalletId();
    const refundWallet = await getMintWalletServer(walletId);
    console.log('refundWallet', refundWallet);
    const availableBalance = refundWallet.getAvailableBalance();
    console.log('availableBalance', availableBalance);
    process.exit();
}

const run = async () => {
    await Firebase.init();
    // @ts-expect-error
    await handleRefunds({}, {});
    process.exit();
}

run();