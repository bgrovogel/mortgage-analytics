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

    expect(store.change()).toEqual({ loan: { ...loan, balance: 250_000 }, from: 'Refinance', version: 2 });
  });

  it('does not count the same loan sent again as a change', () => {
    store.update(loan, 'Calculator');
    store.update({ ...loan }, 'Pay off or invest');

    expect(store.change()).toEqual({ loan, from: 'Calculator', version: 1 });
  });

  it("keeps the home's value when a page that does not ask for it sends a loan", () => {
    store.update(loan, 'Pay off or invest');
    store.update({ ...loan, balance: 250_000, homeValue: null }, 'Refinance');

    expect(store.change()!.loan.homeValue).toBe(400_000);
  });
});
