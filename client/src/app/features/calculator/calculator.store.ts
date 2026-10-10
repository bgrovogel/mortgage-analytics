import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { AmortizationRequest, AmortizationResponse } from '../../core/models/amortization.models';
import { SavedCalculation } from '../../core/models/saved-calculation.models';
import { AmortizationApiService } from '../../core/services/amortization-api.service';
import { latestRequest } from '../../core/state/latest-request';

export { RECALCULATE_DELAY_MS } from '../../core/state/latest-request';

/**
 * The calculator's state, shared by the form, the result tabs and other pages: the latest request,
 * its result, any errors, and whether a calculation is pending. It lives for the whole app, so moving
 * between pages keeps the current calculation.
 */
@Injectable({ providedIn: 'root' })
export class CalculatorStore {
  private readonly api = inject(AmortizationApiService);
  private readonly latest = latestRequest<AmortizationRequest, AmortizationResponse>(
    (request) => this.api.calculate(request),
    inject(DestroyRef),
  );

  /** The latest request, or null before the first one. A form opening later restores it. */
  readonly request = this.latest.request;

  /** The latest successful analysis, or null before the first one arrives. */
  readonly result = this.latest.result;

  /** Messages from the most recent failed request. Empty when the last request succeeded. */
  readonly errors = this.latest.errors;

  /** True from the first change until its result arrives, including the debounce wait. */
  readonly busy = this.latest.busy;

  /** The saved calculation the current one came from or was saved as, so it can be updated in place. */
  readonly saved = signal<Pick<SavedCalculation, 'id' | 'name'> | null>(null);

  /** Whether the headline numbers are on screen; when they are not, phones show a compact summary bar. */
  readonly headlineVisible = signal(false);

  /** Queues a calculation; it runs after a short pause, and any calculation still in flight is cancelled. */
  calculate(request: AmortizationRequest): void {
    this.latest.send(request);
  }

  /** Loads a saved calculation: its inputs are calculated, and later saves can update it in place. */
  open(calculation: SavedCalculation): void {
    this.linkTo(calculation);
    this.calculate(calculation.inputs);
  }

  /** Records that the current calculation is this saved one (after saving or renaming it). */
  linkTo({ id, name }: Pick<SavedCalculation, 'id' | 'name'>): void {
    this.saved.set({ id, name });
  }
}
