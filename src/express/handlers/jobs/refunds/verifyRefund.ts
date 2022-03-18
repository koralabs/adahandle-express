import { CreatedBySystem, SPO_HANDLE_ADA_REFUND_FEE } from "../../../../helpers/constants";
import { lookupTransaction } from "../../../../helpers/graphql";
import { LogCategory, Logger } from "../../../../helpers/Logger";
import { toLovelace } from "../../../../helpers/utils";
import { Status } from "../../../../models/ActiveSession";
import { ActiveSessions } from "../../../../models/firestore/collections/ActiveSession";
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

    const session = await ActiveSessions.getByPaymentAddress(address);

    if (!session) {
        // There should never not be a session
        Logger.log({ message: `${address} has a no active session`, event: 'verifyRefunds.noActiveSession', category: LogCategory.NOTIFY });
        return {
            status: UsedAddressStatus.BAD_STATE
        };
    }

    const { createdBySystem, handle, status, cost } = session;
    const { totalPayments } = results;

    // Is it possible for a good payment to come in after a refund?
    let lovelaceBalance;
    if (status === Status.REFUNDABLE) {
        // If there is a refundable sessions, we need to refund the entire amount
        lovelaceBalance = totalPayments;
    } else {
        if (!cost) {
            Logger.log({ message: `${address} session has no cost`, event: 'verifyRefunds.activeSessionNoCost', category: LogCategory.NOTIFY });
            return {
                status: UsedAddressStatus.BAD_STATE
            };
        }

        lovelaceBalance = totalPayments > cost ? totalPayments - cost : cost - totalPayments;
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
                returnAddress: {
                    amount: lovelaceBalance,
                    address: results.returnAddress,
                    txHash: results.txHash,
                    index: results.index
                }
            }
        }
    }

    return {
        status: UsedAddressStatus.PROCESSED
    };
}
