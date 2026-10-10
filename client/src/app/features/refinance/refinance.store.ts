import { Injectable, inject } from '@angular/core';
import { describeRefinance, suggestRefinanceName } from '../../core/formatting/describe-inputs';
import { RefinanceRequest, RefinanceResponse } from '../../core/models/refinance.models';
import { RefinanceApiService } from '../../core/services/refinance-api.service';
import { CalculationStore } from '../../core/state/calculation-store';

/** The refinance comparison's state. */
@Injectable({ providedIn: 'root' })
export class RefinanceStore extends CalculationStore<RefinanceRequest, RefinanceResponse> {
  private readonly api = inject(RefinanceApiService);

  readonly kind = 'Refinance';
  readonly route = ['/refinance'];

  describe = describeRefinance;
  suggestName = suggestRefinanceName;

  protected send$(request: RefinanceRequest) {
    return this.api.analyze(request);
  }
}
