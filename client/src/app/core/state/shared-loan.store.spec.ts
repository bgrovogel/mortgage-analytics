import { TestBed } from '@angular/core/testing';
import { SharedLoan, SharedLoanStore } from './shared-loan.store';

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
});
