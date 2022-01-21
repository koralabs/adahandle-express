import { CreatedBySystem, SPO_HANDLE_ADA_REFUND_FEE } from "../../../../helpers/constants";
import { lookupTransaction } from "../../../../helpers/graphql";
import { LogCategory, Logger } from "../../../../helpers/Logger";
import { toLovelace } from "../../../../helpers/utils";
import { PaidSessions } from "../../../../models/firestore/collections/PaidSessions";
import { StakePools } from "../../../../models/firestore/collections/StakePools";
import { UsedAddresses } from "../../../../models/firestore/collections/UsedAddresses";
import { UsedAddressStatus } from "../../../../models/UsedAddress";
import { Refund } from "./processRefunds";

export const verifyRefund = async (address: string): Promise<Refund | null> => {
    let results;
    try {
        results = await lookupTransaction(address);
    } catch (error) {
        Logger.log({ message: `lookupTransaction errored on address: ${address}`, event: 'verifyRefunds.lookupTransactionError', category: LogCategory.NOTIFY });
    }

    if (!results) {
        return null;
    }

    if (results.totalPayments === 0) {
        await UsedAddresses.updateUsedAddressStatus(address, UsedAddressStatus.PROCESSED);
        return null;
    }

    if (!results.returnAddress) {
        Logger.log({ message: `${address} has no return address`, event: 'verifyRefunds.noReturnAddress', category: LogCategory.NOTIFY });
        await UsedAddresses.updateUsedAddressStatus(address, UsedAddressStatus.BAD_STATE);
        return null;
    }

    const paymentSession = await PaidSessions.getPaidSessionByWalletAddress(address);
    if (!paymentSession) {
        Logger.log({ message: `There was a transaction for address: ${address} with no payment session. This should not happen.`, event: 'verifyRefunds.noPaymentSession', category: LogCategory.NOTIFY });
        await UsedAddresses.updateUsedAddressStatus(address, UsedAddressStatus.BAD_STATE);
        return null;
    }

    let lovelaceBalance = results.totalPayments - toLovelace(paymentSession.cost ?? 0);

    if (paymentSession.createdBySystem === CreatedBySystem.SPO) {
        const returnAddressOwnsStakePool = await StakePools.verifyReturnAddressOwnsStakePool(results.returnAddress, paymentSession.handle);
        if (!returnAddressOwnsStakePool) {
            // return address does not own stake pool. Refund and deduct a fee
            lovelaceBalance = Math.max(0, results.totalPayments - toLovelace(SPO_HANDLE_ADA_REFUND_FEE))
        }
    }

    // only refund if balance is greater than 2 lovelace (we aren't refunding payments that are less than 2 lovelace)
    if (lovelaceBalance > toLovelace(1)) {
        return {
            paymentAddress: address,
            returnAddress: results.returnAddress,
            amount: lovelaceBalance,
        }
    }

    await UsedAddresses.updateUsedAddressStatus(address, UsedAddressStatus.PROCESSED);
    return null;
}
