import { DestroyRef, computed, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { INPUTS_FIELD, SavedCalculation, SavedCalculationKind, SavedInputs, savedInputsFor } from '../models/saved-calculation.models';
import { latestRequest } from './latest-request';
import { SharedLoan, SharedLoanChange, SharedLoanStore, SharedRate, sameLoan, sameRate } from './shared-loan.store';

/** The saved calculation a page is showing: enough to update it in place, and to name it. */
export type SavedLink = Pick<SavedCalculation, 'id' | 'name'>;

/**
 * The state of one calculator page (purchase, refinance, or pay off or invest): the latest request, its result,
 * errors, whether a result is pending, and the saved calculation it is linked to. A page's store lives for the
 * whole app, so leaving the page and coming back keeps its numbers.
 *
 * Each page says only what differs: how to send a request, which kind of saved calculation it opens, how to
 * describe and name its inputs, and where its loan is. Everything else is written once here (DRY).
 *
 * A request that changes the loan also updates the shared loan (SharedLoanStore), so a loan typed on one page is
 * where the next page starts: `loanToApply` is the loan another page changed since this page last sent one.
 * Only a loan the user typed, or a saved one they opened, is shared: merely opening a page (which sends its
 * example, or what it showed last) changes nothing for the others.
 */
export abstract class CalculationStore<TRequest, TResponse> {
  /** The kind of saved calculation this page shows. */
  abstract readonly kind: SavedCalculationKind;

  /** Where a saved calculation of this kind opens. */
  abstract readonly route: readonly string[];

  /** The page's name, as the navigation shows it, e.g. "Calculator". */
  abstract readonly pageName: string;

  private readonly sharedLoan = inject(SharedLoanStore);

  /** The shared loan's version when this page last sent a request. */
  private seenLoanVersion = 0;

  private readonly latest = latestRequest<TRequest, TResponse>((request) => this.send$(request), inject(DestroyRef));

  /** The latest request, or null before the first one. A form opening later restores it. */
  readonly request = this.latest.request;

  /** The latest successful result, or null before the first one arrives. */
  readonly result = this.latest.result;

  /** Messages from the most recent failed request. Empty when the last request succeeded. */
  readonly errors = this.latest.errors;

  /** True from the first change until its result arrives, including the pause. */
  readonly busy = this.latest.busy;

  /** The saved calculation the current one came from or was saved as, so it can be updated in place. */
  readonly saved = signal<SavedLink | null>(null);

  /** What Save stores: the current inputs, once there are any. */
  readonly savePayload = computed<SavedInputs | null>(() => {
    const request = this.request();
    return request ? savedInputsFor(this.kind, request) : null;
  });

  /** The name Save suggests for the current inputs. */
  readonly suggestedName = computed(() => {
    const request = this.request();
    return request ? this.suggestName(request) : '';
  });

  /** Queues a request; it is sent after a short pause, and any request still in flight is cancelled. */
  send(request: TRequest): void {
    const before = this.request();
    this.latest.send(request);
    // The first request is the page's example (or the shared loan already); only a change after it is the user's.
    const shared = this.sharedLoan.change()?.loan;
    if (before && !sameLoan(this.loanOf(before), this.loanOf(request)) && !(shared && this.matchesShared(request, shared))) {
      this.share(request);
    }
    this.seenLoanVersion = this.sharedLoan.version();
  }

  /** Sends the latest request again, e.g. after the server could not be reached. Nothing else changes. */
  retry(): void {
    const request = this.request();
    if (request) this.latest.send(request);
  }

  /** The loan another page has changed since this page last sent a request, or null when this page is up to date. */
  loanToApply(): SharedLoanChange | null {
    const change = this.sharedLoan.change();
    return change && change.version > this.seenLoanVersion ? change : null;
  }

  /**
   * Loads a saved calculation of this page's kind (others are ignored); later saves can update it in place.
   * Opening one chooses its loan, so the other pages follow it too.
   */
  open(calculation: SavedCalculation): void {
    if (calculation.kind !== this.kind) return;
    const request = this.inputsOf(calculation);
    this.linkTo(calculation);
    this.send(request);
    this.share(request);
  }

  /** Records that the current calculation is this saved one (after saving or renaming it). */
  linkTo({ id, name }: SavedLink): void {
    this.saved.set({ id, name });
  }

  /**
   * True when this page's request holds the shared loan, as closely as the page can. Then it is not shared again:
   * a page that rounds the loan (the calculator's whole-year term) must not send the rounding back to the others.
   */
  protected matchesShared(request: TRequest, shared: SharedLoan): boolean {
    const own = this.loanOf(request);
    return sameLoan({ ...own, rate: null }, { ...shared, rate: null }) && this.rateMatches(own.rate ?? null, shared.rate ?? null);
  }

  /** False on a page that has no buydown option for this loan (it shows a shared buydown as fixed). */
  protected readonly holdsBuydowns: boolean = true;

  /**
   * True when this page's rate type is the shared one, as closely as it can hold it: either side unknown counts as
   * a match, and so does a fixed rate here for a shared buydown on a page that cannot hold buydowns.
   */
  protected rateMatches(own: SharedRate | null, shared: SharedRate | null): boolean {
    if (own === null || shared === null) return true;
    if (!this.holdsBuydowns && own.kind === 'fixed' && shared.kind === 'buydown') return true;
    return sameRate(own, shared);
  }

  /** Makes this request's loan the one every page starts from. */
  private share(request: TRequest): void {
    this.sharedLoan.update(this.loanOf(request), this.pageName, this.holdsBuydowns);
    this.seenLoanVersion = this.sharedLoan.version();
  }

  /** The inputs a saved calculation of this page's kind holds. */
  inputsOf(calculation: SavedCalculation): TRequest {
    return calculation[INPUTS_FIELD[this.kind]] as TRequest;
  }

  /** One line that tells saved calculations of this kind apart, e.g. in History. */
  abstract describe(request: TRequest): string;

  /** A starting name for saving these inputs. */
  abstract suggestName(request: TRequest): string;

  /** The loan a request is about. */
  protected abstract loanOf(request: TRequest): SharedLoan;

  /** Sends one request to the API. */
  protected abstract send$(request: TRequest): Observable<TResponse>;
}
