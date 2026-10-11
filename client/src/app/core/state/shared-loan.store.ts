import { Injectable, computed, signal } from '@angular/core';
import { AdjustableRateInput, TemporaryBuydownInput } from '../models/amortization.models';
import { OriginalLoan } from '../models/refinance.models';

/**
 * How the shared loan's rate works, counted from today so every page can read it: fixed; a buydown starting with
 * the next payment (the points off in each year); or adjustable, with the payments until its next reset, how often
 * it resets after that, the rate expected, and the caps (the first one applying to that next reset).
 */
export type SharedRate =
  | { kind: 'fixed' }
  | { kind: 'buydown'; yearlyReductions: number[] }
  | { kind: 'arm'; nextResetIn: number; intervalMonths: number; expectedRate: number; initialCap: number; periodicCap: number; lifetimeCap: number };

/**
 * The shared rate for a loan's buydown or adjustable rate, given the payments already made on it; null when it
 * cannot be said from today (a buydown already under way, or an ARM past its first reset), so other pages keep theirs.
 */
export function sharedRateFrom(
  buydown: TemporaryBuydownInput | null | undefined, arm: AdjustableRateInput | null | undefined, made = 0,
): SharedRate | null {
  if (buydown) return made === 0 ? { kind: 'buydown', yearlyReductions: [...buydown.yearlyReductions] } : null;
  if (arm) {
    const nextResetIn = arm.initialFixedMonths - made;
    return nextResetIn >= 1
      ? {
          kind: 'arm', nextResetIn, intervalMonths: arm.adjustmentIntervalMonths, expectedRate: arm.expectedRate,
          initialCap: arm.initialCap, periodicCap: arm.periodicCap, lifetimeCap: arm.lifetimeCap,
        }
      : null;
  }
  return { kind: 'fixed' };
}

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
  /** How its rate works, when the page can say; null (or missing) leaves each page's own rate type alone. */
  rate?: SharedRate | null;
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
   * shared; one that does not know how the loan started, or how its rate works, keeps those too, as long as the
   * loan itself is unchanged. A page that cannot hold a buydown (it shows one as fixed) keeps a shared buydown.
   * Sending the same loan again is not a change.
   */
  update(loan: SharedLoan, from: string, holdsBuydowns = true): void {
    const current = this.latest();
    const unchanged = current !== null && current.loan.balance === loan.balance
      && current.loan.annualInterestRate === loan.annualInterestRate && current.loan.remainingTermInMonths === loan.remainingTermInMonths;
    const next: SharedLoan = {
      ...loan,
      homeValue: loan.homeValue ?? current?.loan.homeValue ?? null,
      start: loan.start ?? (unchanged ? current.loan.start ?? null : null),
      rate: !holdsBuydowns && loan.rate?.kind === 'fixed' && current?.loan.rate?.kind === 'buydown'
        ? current.loan.rate
        : loan.rate ?? (unchanged ? current.loan.rate ?? null : null),
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
    && sameStart(a.start ?? null, b.start ?? null)
    && sameRate(a.rate ?? null, b.rate ?? null);
}

/** True when two rate types are the same in every respect. */
export function sameRate(a: SharedRate | null, b: SharedRate | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function sameStart(a: OriginalLoan | null, b: OriginalLoan | null): boolean {
  return a === b || (a !== null && b !== null && a.amount === b.amount && a.termInMonths === b.termInMonths && a.firstPaymentDate === b.firstPaymentDate);
}
