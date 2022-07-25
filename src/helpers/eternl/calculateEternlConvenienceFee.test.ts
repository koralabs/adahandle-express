import { calculateEternlConvenienceFee } from './calculateEternlConvenienceFee';

describe('calculateEternlConvenienceFee Tests', () => {
    it('Should return 0 ADA for costs under 100 ADA (15)', () => {
        const fee = calculateEternlConvenienceFee(15);
        expect(fee).toEqual(0);
    });

    it('Should return 0 ADA for costs under 100 ADA (99)', () => {
        const fee = calculateEternlConvenienceFee(99);
        expect(fee).toEqual(0);
    });

    it('Should return 1 ADA for costs over 100 ADA (100)', () => {
        const fee = calculateEternlConvenienceFee(100);
        expect(fee).toEqual(1);
    });

    it('Should return 1 ADA for costs over 100 ADA (101)', () => {
        const fee = calculateEternlConvenienceFee(101);
        expect(fee).toEqual(1);
    });

    it('Should return 1 ADA for costs over 1999 ADA (1999)', () => {
        const fee = calculateEternlConvenienceFee(1999);
        expect(fee).toEqual(1);
    });

    it('Should return 2 ADA when percentage is more than 0.1%', () => {
        const fee = calculateEternlConvenienceFee(2000);
        expect(fee).toEqual(2);
    });

    it('Should return correct fee for large cost', () => {
        const fee = calculateEternlConvenienceFee(5631);
        expect(fee).toEqual(5);
    });
});
