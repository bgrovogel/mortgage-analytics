import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CalculationStore } from './calculation-store';
import { SharedLoan, SharedRate } from './shared-loan.store';

/** A page whose request is the loan itself, to test the matching every page inherits. */
class LoanPageStore extends CalculationStore<SharedLoan, unknown> {
  readonly kind = 'Refinance';
  readonly route = ['/test'];
  readonly pageName = 'Test';
  describe = () => '';
  suggestName = () => '';
  protected loanOf(request: SharedLoan): SharedLoan { return request; }
  protected send$() { return of(null); }
  holds(request: SharedLoan, shared: SharedLoan): boolean { return this.matchesShared(request, shared); }
}

/** The same page, without a buydown option (it shows a shared buydown as fixed). */
class NoBuydownPageStore extends LoanPageStore {
  protected override readonly holdsBuydowns = false;
}

describe('CalculationStore: does a page hold the shared loan?', () => {
  const loan: SharedLoan = { balance: 300_000, annualInterestRate: 6.5, remainingTermInMonths: 300, homeValue: 400_000, start: null, rate: { kind: 'fixed' } };
  const buydown: SharedRate = { kind: 'buydown', yearlyReductions: [2, 1] };
  const arm: SharedRate = { kind: 'arm', nextResetIn: 12, intervalMonths: 12, expectedRate: 7, initialCap: 2, periodicCap: 1, lifetimeCap: 5, margin: null };
  const page = () => TestBed.runInInjectionContext(() => new LoanPageStore());
  const noBuydowns = () => TestBed.runInInjectionContext(() => new NoBuydownPageStore());

  it('holds the same loan, and not one that differs in anything but its rate type', () => {
    expect(page().holds(loan, { ...loan })).toBe(true);
    expect(page().holds(loan, { ...loan, balance: 299_000 })).toBe(false);
    expect(page().holds(loan, { ...loan, homeValue: null })).toBe(false);
  });

  it('counts a rate type either side does not know as a match', () => {
    expect(page().holds({ ...loan, rate: null }, { ...loan, rate: arm })).toBe(true);
    expect(page().holds({ ...loan, rate: arm }, { ...loan, rate: undefined })).toBe(true);
  });

  it('holds a different rate type only as a fixed rate for a buydown, on a page that cannot hold buydowns', () => {
    expect(page().holds(loan, { ...loan, rate: buydown })).toBe(false);
    expect(noBuydowns().holds(loan, { ...loan, rate: buydown })).toBe(true);
    expect(noBuydowns().holds({ ...loan, rate: arm }, { ...loan, rate: buydown })).toBe(false);
    expect(noBuydowns().holds({ ...loan, rate: buydown }, { ...loan, rate: { kind: 'fixed' } })).toBe(false);
  });
});
