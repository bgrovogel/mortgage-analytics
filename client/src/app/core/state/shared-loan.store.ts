import { Injectable, computed, signal } from '@angular/core';
import { OriginalLoan } from '../models/refinance.models';

/** The mortgage every page asks about: what is owed, at what rate, for how long, on a home worth how much. */
export interface SharedLoan {
  balance: number;
  annualInterestRate: number;
  remainingTermInMonths: number;
  /** The home's value, when the page knows it (the refinance page does not ask). */
  homeValue: number | null;
  /**
   * The loan as it was taken out, when the page knows it (the calculator and the refinance page can): its
   * pages then show the real start, and work from it rather than backwards from the balance.
   */
  start?: OriginalLoan | null;
}

/** The shared loan, and the page it was last changed on (e.g. "Calculator"). */
export interface SharedLoanChange {
  loan: SharedLoan;
  from: string;
  /** Goes up by one with every change, so each page can tell whether it has seen the latest. */
  version: number;
}

/**
 * The loan the user is working on, shared by the calculator, the refinance comparison and pay off or invest, so
 * it is typed once: change the balance, rate or years left on one page, and the next page opened starts from it.
 * It is the last loan entered on any page; each page keeps its own other inputs.
 */
@Injectable({ providedIn: 'root' })
export class SharedLoanStore {
  private readonly latest = signal<SharedLoanChange | null>(null);

  /** The latest loan, or null before any page has sent one. */
  readonly change = this.latest.asReadonly();

  /** The latest version; 0 before any page has sent a loan. */
  readonly version = computed(() => this.latest()?.version ?? 0);

  /**
   * Records the loan a page has just sent. A page that does not know the home's value keeps the one already
   * shared; one that does not know how the loan started keeps that too, as long as the loan itself is unchanged.
   * Sending the same loan again is not a change.
   */
  update(loan: SharedLoan, from: string): void {
    const current = this.latest();
    const unchanged = current !== null && current.loan.balance === loan.balance
      && current.loan.annualInterestRate === loan.annualInterestRate && current.loan.remainingTermInMonths === loan.remainingTermInMonths;
    const next: SharedLoan = {
      ...loan,
      homeValue: loan.homeValue ?? current?.loan.homeValue ?? null,
      start: loan.start ?? (unchanged ? current.loan.start ?? null : null),
    };
    if (current && sameLoan(current.loan, next)) return;
    this.latest.set({ loan: next, from, version: (current?.version ?? 0) + 1 });
  }
}

/** True when two loans are the same in every respect. */
export function sameLoan(a: SharedLoan, b: SharedLoan): boolean {
  return a.balance === b.balance
    && a.annualInterestRate === b.annualInterestRate
    && a.remainingTermInMonths === b.remainingTermInMonths
    && a.homeValue === b.homeValue
    && sameStart(a.start ?? null, b.start ?? null);
}

function sameStart(a: OriginalLoan | null, b: OriginalLoan | null): boolean {
  return a === b || (a !== null && b !== null && a.amount === b.amount && a.termInMonths === b.termInMonths && a.firstPaymentDate === b.firstPaymentDate);
}
