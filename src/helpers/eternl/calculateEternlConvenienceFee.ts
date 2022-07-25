export const calculateEternlConvenienceFee = (adaCost: number): number => {
    // no fee on buy orders/swaps < 100 ADA
    if (adaCost < 100) {
        return 0;
    }

    // 0.1% or 1 ADA (whichever is higher) on every buy order/swap >= 100 ADA.
    const fee = 1;

    const percentageCost = Math.floor((0.1 * adaCost) / 100);

    return percentageCost >= fee ? percentageCost : fee;
};
