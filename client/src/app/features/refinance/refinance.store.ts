import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { RefinanceRequest, RefinanceResponse } from '../../core/models/refinance.models';
import { SavedCalculation } from '../../core/models/saved-calculation.models';
import { RefinanceApiService } from '../../core/services/refinance-api.service';
import { latestRequest } from '../../core/state/latest-request';

/**
 * The refinance comparison's state: the latest request, its result, errors and busy flag. It lives for
 * the whole app, so leaving the page and coming back keeps the comparison.
 */
@Injectable({ providedIn: 'root' })
export class RefinanceStore {
  private readonly api = inject(RefinanceApiService);
  private readonly latest = latestRequest<RefinanceRequest, RefinanceResponse>((r) => this.api.analyze(r), inject(DestroyRef));

  /** The latest request, or null before the first one. */
  readonly request = this.latest.request;

  /** The latest comparison, or null before the first one arrives. */
  readonly result = this.latest.result;

  /** Messages from the most recent failed request. */
  readonly errors = this.latest.errors;

  /** True from the first change until its result arrives. */
  readonly busy = this.latest.busy;

  /** The saved comparison this one came from or was saved as, so it can be updated in place. */
  readonly saved = signal<Pick<SavedCalculation, 'id' | 'name'> | null>(null);

  /** Queues a comparison; it runs after a short pause, cancelling any still in flight. */
  analyze(request: RefinanceRequest): void {
    this.latest.send(request);
  }

  /** Loads a saved refinance comparison; later saves can update it in place. */
  open(calculation: SavedCalculation): void {
    if (!calculation.refinance) return; // a purchase calculation opens in the CalculatorStore
    this.linkTo(calculation);
    this.analyze(calculation.refinance);
  }

  /** Records that the current comparison is this saved one. */
  linkTo({ id, name }: Pick<SavedCalculation, 'id' | 'name'>): void {
    this.saved.set({ id, name });
  }
}
