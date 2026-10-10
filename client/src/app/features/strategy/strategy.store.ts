import { Injectable, inject } from '@angular/core';
import { describeStrategy, suggestStrategyName } from '../../core/formatting/describe-inputs';
import { StrategyComparison, StrategyRequest } from '../../core/models/strategy.models';
import { StrategyApiService } from '../../core/services/strategy-api.service';
import { CalculationStore } from '../../core/state/calculation-store';

/** The pay-off-or-invest comparison's state. */
@Injectable({ providedIn: 'root' })
export class StrategyStore extends CalculationStore<StrategyRequest, StrategyComparison> {
  private readonly api = inject(StrategyApiService);

  readonly kind = 'Strategy';
  readonly route = ['/strategy'];

  describe = describeStrategy;
  suggestName = suggestStrategyName;

  protected send$(request: StrategyRequest) {
    return this.api.compare(request);
  }
}
