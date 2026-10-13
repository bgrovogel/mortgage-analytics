import { TestBed } from '@angular/core/testing';
import { SharedLoan, SharedLoanStore, SharedRate, sameLoan, sharedRateFrom } from './shared-loan.store';

describe('SharedLoanStore', () => {
  const loan: SharedLoan = { balance: 300_000, annualInterestRate: 6.5, remainingTermInMonths: 300, homeValue: 400_000 };
  let store: SharedLoanStore;

  beforeEach(() => (store = TestBed.inject(SharedLoanStore)));

  it('has no loan until a page sends one', () => {
    expect(store.change()).toBeNull();
    expect(store.version()).toBe(0);
  });

  it('records each new loan, the page it came from, and a new version', () => {
    store.update(loan, 'Calculator');
    store.update({ ...loan, balance: 250_000 }, 'Refinance');

    expect(store.change()).toEqual({ loan: { ...loan, balance: 250_000, start: null, rate: null }, from: 'Refinance', version: 2 });
  });

  it('does not count the same loan sent again as a change', () => {
    store.update(loan, 'Calculator');
    store.update({ ...loan }, 'Pay off or invest');

    expect(store.change()).toEqual({ loan: { ...loan, start: null, rate: null }, from: 'Calculator', version: 1 });
  });

  it('keeps how the loan started while the loan is unchanged, and drops it once a page without it changes the loan', () => {
    const start = { amount: 300_000, termInMonths: 360, firstPaymentDate: '2021-11-01' };
    store.update({ ...loan, start }, 'Calculator');

    store.update({ ...loan, homeValue: 420_000 }, 'Pay off or invest'); // only the home value is new
    expect(store.change()!.loan.start).toEqual(start);

    store.update({ ...loan, balance: 250_000 }, 'Pay off or invest');
    expect(store.change()!.loan.start).toBeNull();
  });

  it("keeps the home's value when a page that does not ask for it sends a loan", () => {
    store.update(loan, 'Pay off or invest');
    store.update({ ...loan, balance: 250_000, homeValue: null }, 'Refinance');

    expect(store.change()!.loan.homeValue).toBe(400_000);
  });

  it('keeps the rate type while the loan is unchanged, and drops it once a page without one changes the rate or the term', () => {
    const fixed: SharedRate = { kind: 'fixed' };
    store.update({ ...loan, rate: fixed }, 'Calculator');
    store.update({ ...loan, rate: null }, 'Refinance');
    const unchanged = store.change()!.loan.rate;
    store.update({ ...loan, annualInterestRate: 6 }, 'Refinance');
    const newRate = store.change()!.loan.rate;
    store.update({ ...loan, rate: fixed }, 'Calculator');
    store.update({ ...loan, remainingTermInMonths: 240 }, 'Refinance');

    expect(unchanged).toEqual(fixed);
    expect(newRate).toBeNull();
    expect(store.change()!.loan.rate).toBeNull();
  });

  it('keeps a shared buydown when a page that cannot hold one sends it as fixed, but not from a page that can', () => {
    const buydown: SharedRate = { kind: 'buydown', yearlyReductions: [2, 1] };
    store.update({ ...loan, rate: buydown }, 'Calculator');
    store.update({ ...loan, rate: { kind: 'fixed' } }, 'Pay off or invest', false);
    const kept = store.change()!.loan.rate;
    store.update({ ...loan, rate: { kind: 'fixed' } }, 'Refinance');

    expect(kept).toEqual(buydown);
    expect(store.change()!.loan.rate).toEqual({ kind: 'fixed' });
  });

  it('treats a new start or a new rate type as a change', () => {
    const start = { amount: 300_000, termInMonths: 360, firstPaymentDate: '2021-11-01' };
    store.update({ ...loan, start }, 'Calculator');
    store.update({ ...loan, start: { ...start, amount: 310_000 } }, 'Calculator');
    store.update({ ...loan, start: { ...start, amount: 310_000, termInMonths: 300 } }, 'Calculator');
    store.update({ ...loan, start: { ...start, amount: 310_000, termInMonths: 300, firstPaymentDate: '2021-12-01' } }, 'Calculator');
    store.update({ ...loan, start: { ...start, amount: 310_000, termInMonths: 300, firstPaymentDate: '2021-12-01' }, rate: { kind: 'fixed' } }, 'Calculator');

    expect(store.version()).toBe(5);
  });
});

describe('sameLoan', () => {
  const loan: SharedLoan = {
    balance: 300_000, annualInterestRate: 6.5, remainingTermInMonths: 300, homeValue: 400_000,
    start: { amount: 320_000, termInMonths: 360, firstPaymentDate: '2021-11-01' }, rate: { kind: 'fixed' },
  };

  it('is true for an equal copy, and false for a difference in any one part', () => {
    expect(sameLoan(loan, JSON.parse(JSON.stringify(loan)))).toBe(true);
    for (const other of [
      { homeValue: 410_000 }, { start: null }, { start: { ...loan.start!, amount: 1 } }, { start: { ...loan.start!, termInMonths: 1 } },
      { start: { ...loan.start!, firstPaymentDate: '2022-01-01' } }, { rate: { kind: 'buydown', yearlyReductions: [1] } as SharedRate },
    ]) {
      expect(sameLoan(loan, { ...loan, ...other })).toBe(false);
      expect(sameLoan({ ...loan, ...other }, loan)).toBe(false);
    }
  });
});

describe('sharedRateFrom', () => {
  const arm = { initialFixedMonths: 60, adjustmentIntervalMonths: 12, expectedRate: 7.5, initialCap: 5, periodicCap: 2, lifetimeCap: 5 };

  it('shares a buydown only before its first payment, when it can still be said from today', () => {
    expect(sharedRateFrom({ yearlyReductions: [2, 1] }, null, 0)).toEqual({ kind: 'buydown', yearlyReductions: [2, 1] });
    expect(sharedRateFrom({ yearlyReductions: [2, 1] }, null, 1)).toBeNull();
  });

  it('shares an ARM counted from today, up to the payment before its first reset', () => {
    expect(sharedRateFrom(null, arm, 59)).toEqual(expect.objectContaining({ kind: 'arm', nextResetIn: 1, margin: null }));
    expect(sharedRateFrom(null, arm, 60)).toBeNull();
  });
});
