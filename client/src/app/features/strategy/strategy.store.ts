import { DestroyRef, Injectable, inject } from '@angular/core';
import { StrategyComparison, StrategyRequest } from '../../core/models/strategy.models';
import { StrategyApiService } from '../../core/services/strategy-api.service';
import { latestRequest } from '../../core/state/latest-request';

/**
 * The strategy comparison's state: the latest request, its result, errors and busy flag. It lives for the
 * whole app, so leaving the page and coming back keeps the comparison.
 */
@Injectable({ providedIn: 'root' })
export class StrategyStore {
  private readonly api = inject(StrategyApiService);
  private readonly latest = latestRequest<StrategyRequest, StrategyComparison>((r) => this.api.compare(r), inject(DestroyRef));

  /** The latest request, or null before the first one. */
  readonly request = this.latest.request;

  /** The latest comparison, or null before the first one arrives. */
  readonly result = this.latest.result;

  /** Messages from the most recent failed request. */
  readonly errors = this.latest.errors;

  /** True from the first change until its result arrives. */
  readonly busy = this.latest.busy;

  /** Queues a comparison; it runs after a short pause, cancelling any still in flight. */
  compare(request: StrategyRequest): void {
    this.latest.send(request);
  }
}
