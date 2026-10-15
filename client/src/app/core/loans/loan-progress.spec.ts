import { balanceAfter, biweeklyExtra, firstOfMonthFromNext, loanToday, monthlyPayment, originalAmount, paymentsMade } from './loan-progress';

describe('monthlyPayment', () => {
  it('is the payment that repays the loan: $377,650 at 6.25% over 30 years is $2,325.26', () => {
    expect(monthlyPayment(377_650, 6.25, 360)).toBe(2_325.26);
    expect(monthlyPayment(200_000, 6.5, 360)).toBe(1_264.14);
  });

  it('is the loan over the months when there is no interest, and nothing when there is no loan', () => {
    expect(monthlyPayment(120_000, 0, 120)).toBe(1_000);
    expect(monthlyPayment(0, 6, 360)).toBe(0);
    expect(monthlyPayment(100_000, 6, 0)).toBe(0);
  });
});

describe('biweeklyExtra', () => {
  it('is a twelfth of the payment: thirteen payments a year instead of twelve', () => {
    expect(biweeklyExtra(2_325.26)).toBe(193.77);
    expect(biweeklyExtra(1_264.14)).toBe(105.35);
    expect(biweeklyExtra(0)).toBe(0);
  });
});

describe('existing loan', () => {
  const today = new Date(2026, 9, 10); // Oct 10, 2026

  it('counts the payments already made: every due date before today', () => {
    expect(paymentsMade('2024-01-01', today)).toBe(34); // Jan 2024 through Oct 2026
    expect(paymentsMade('2024-01-15', today)).toBe(33); // Oct 15 is still ahead
    expect(paymentsMade('2026-10-10', today)).toBe(0); // due today: not yet made
    expect(paymentsMade('2026-11-01', today)).toBe(0); // a new loan
    expect(paymentsMade(null, today)).toBe(0); // no date: next month, a new loan
  });

  it('owes what the textbook formula says after a number of payments', () => {
    // $200,000 at 6% over 30 years (a $1,199.10 payment); a schedule rounding interest to cents owes 197,543.99 and 186,108.80.
    expect(balanceAfter(200_000, 6, 360, 12)).toBeCloseTo(197_543.98, 2);
    expect(balanceAfter(200_000, 6, 360, 60)).toBeCloseTo(186_108.71, 2);
    expect(balanceAfter(200_000, 6, 360, 0)).toBe(200_000);
    expect(balanceAfter(200_000, 6, 360, 360)).toBe(0);
    expect(balanceAfter(120_000, 0, 120, 30)).toBe(90_000); // no interest: straight-line
  });

  it('dates a first payment some months from the first of next month, across year ends', () => {
    expect(firstOfMonthFromNext(0, today)).toBe('2026-11-01'); // the API's default first payment
    expect(firstOfMonthFromNext(-34, today)).toBe('2024-01-01'); // a loan 34 payments in
    expect(firstOfMonthFromNext(2, new Date(2026, 11, 31))).toBe('2027-03-01');
  });

  it('works back from what is owed to what was first borrowed', () => {
    expect(originalAmount(186_108.71, 6, 360, 60)).toBeCloseTo(200_000, 1);
    expect(originalAmount(90_000, 0, 120, 30)).toBe(120_000);
    expect(originalAmount(250_000, 7, 300, 0)).toBe(250_000);
  });

  it('says where a loan stands today: owed, payments left, and the home grown by a full year at a time', () => {
    const loan = { homePrice: 250_000, downPayment: 50_000, annualInterestRate: 6, termInMonths: 360, homeValueGrowthRate: 4 };

    expect(loanToday({ ...loan, firstPaymentDate: '2021-11-01' }, today)).toEqual({
      made: 60, balance: 186_108.71, monthsLeft: 300, homeValue: 304_163.23, // 250,000 × 1.04⁵
    });
    expect(loanToday({ ...loan, firstPaymentDate: '2026-11-01' }, today)).toEqual({ made: 0, balance: 200_000, monthsLeft: 360, homeValue: 250_000 });
  });
});

describe('balanceAfter at the ends of the loan', () => {
  it('is exactly the amount before the first payment, and exactly zero after the last', () => {
    expect(balanceAfter(123_456.78, 6.5, 360, 0)).toBe(123_456.78);
    expect(balanceAfter(123_456.78, 6.5, 360, 360)).toBe(0);
    expect(balanceAfter(123_456.78, 6.5, 360, 400)).toBe(0);
  });
});
