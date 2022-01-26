import { CreatedBySystem, SPO_HANDLE_ADA_REFUND_FEE } from "../../../../helpers/constants";
import { lookupTransaction } from "../../../../helpers/graphql";
import { LogCategory, Logger } from "../../../../helpers/Logger";
import { toLovelace } from "../../../../helpers/utils";
import { PaidSessions } from "../../../../models/firestore/collections/PaidSessions";
import { RefundableSessions } from "../../../../models/firestore/collections/RefundableSessions";
import { StakePools } from "../../../../models/firestore/collections/StakePools";
import { UsedAddressStatus } from "../../../../models/UsedAddress";
import { Refund } from "./processRefunds";

interface VerifyRefundResults {
    refund?: Refund;
    status?: UsedAddressStatus;
}

export const verifyRefund = async (address: string): Promise<VerifyRefundResults | null> => {
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
        return {
            status: UsedAddressStatus.PROCESSED
        };
    }

    if (!results.returnAddress) {
        Logger.log({ message: `${address} has no return address`, event: 'verifyRefunds.noReturnAddress', category: LogCategory.NOTIFY });
        return { status: UsedAddressStatus.BAD_STATE };
    }

    const [paymentSession, refundableSession] = await Promise.all([
        PaidSessions.getPaidSessionByWalletAddress(address),
        RefundableSessions.getRefundableSessionByWalletAddress(address)
    ]);

    if (!paymentSession && !refundableSession) {
        // If there is no payment session or refundable session, 
        // we can assume there was no payment or a refund so we can refund the entire amount
        if (results.totalPayments > toLovelace(1)) {
            return {
                refund: {
                    paymentAddress: address,
                    returnAddress: results.returnAddress,
                    amount: results.totalPayments,
                }
            }
        }

        return {
            status: UsedAddressStatus.PROCESSED
        };
    }

    if (paymentSession && refundableSession) {
        // There should never be both a payment session and a refundable session... right?
        Logger.log({ message: `${address} has a paid session and refundable sessions`, event: 'verifyRefunds.paidSessionAndRefundSession', category: LogCategory.NOTIFY });
        return {
            status: UsedAddressStatus.BAD_STATE
        };
    }

    const createdBySystem = (paymentSession?.createdBySystem ?? refundableSession?.createdBySystem) as CreatedBySystem;
    const handle = (paymentSession?.handle ?? refundableSession?.handle) as string;

    // Is it possible for a good payment to come in after a refund?
    let lovelaceBalance;
    if (refundableSession) {
        // If there is a refundable sessions, we need to refund the entire amount
        lovelaceBalance = results.totalPayments;
    } else {
        if (!paymentSession?.cost) {
            Logger.log({ message: `${address} payment session has no cost`, event: 'verifyRefunds.paymentSessionNoCost', category: LogCategory.NOTIFY });
            return {
                status: UsedAddressStatus.BAD_STATE
            };
        }

        lovelaceBalance = results.totalPayments - toLovelace(paymentSession?.cost ?? 0)
    }

    if (createdBySystem === CreatedBySystem.SPO) {
        const returnAddressOwnsStakePool = await StakePools.verifyReturnAddressOwnsStakePool(results.returnAddress, handle);
        if (!returnAddressOwnsStakePool) {
            // return address does not own stake pool. Refund and deduct a fee
            lovelaceBalance = Math.max(0, lovelaceBalance - toLovelace(SPO_HANDLE_ADA_REFUND_FEE))
        }
    }

    // only refund if balance is greater than 2 lovelace (we aren't refunding payments that are less than 2 lovelace)
    if (lovelaceBalance > toLovelace(1)) {
        return {
            refund: {
                paymentAddress: address,
                returnAddress: results.returnAddress,
                amount: lovelaceBalance,
            }
        }
    }

    return {
        status: UsedAddressStatus.PROCESSED
    };
}
