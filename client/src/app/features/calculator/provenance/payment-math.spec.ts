import { aPayment, aResponse, aSchedule } from '../../../../testing/builders';
import { paymentMath } from './payment-math';

describe('paymentMath', () => {
  /** $377,650 at 6.25% over 360 months: $2,325.26 a month, $1,966.93 of the first payment interest. */
  const example = () => aResponse({
    baseline: aSchedule({
      monthlyPayment: 2_325.26,
      payments: [
        aPayment(1, { interest: 1_966.93, principal: 358.33, annualInterestRate: 6.25, remainingBalance: 377_291.67 }),
        ...Array.from({ length: 359 }, (_, i) => aPayment(i + 2, { annualInterestRate: 6.25, remainingBalance: i === 358 ? 0 : 300_000 })),
      ],
    }),
  });

  it('works the payment out of the balance, the monthly rate and the number of payments, to the cent', () => {
    const math = paymentMath(example())!;

    expect(math.balance).toBe(377_650);
    expect(math.monthlyRatePercent).toBeCloseTo(0.5208, 4);
    expect(math.payments).toBe(360);
    expect(math.payment).toBe(2_325.26);
    expect(math.firstInterest).toBe(1_966.93);
    expect(math.firstPrincipal).toBe(358.33);
    expect(math.endsAtZero).toBe(true);
  });

  it('has no single formula for a rate that changes, or a buydown', () => {
    const changing = aResponse({ baseline: aSchedule({ rateChanges: [{ paymentNumber: 61, effectiveDate: '2031-01-01', previousRate: 6, newRate: 7, previousPayment: 1, newPayment: 2 }] }) });

    expect(paymentMath(changing)).toBeNull();
  });
});
