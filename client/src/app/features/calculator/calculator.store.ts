import { Injectable, inject, signal } from '@angular/core';
import { describeInputs, suggestName } from '../../core/formatting/describe-inputs';
import { AmortizationRequest, AmortizationResponse } from '../../core/models/amortization.models';
import { AmortizationApiService } from '../../core/services/amortization-api.service';
import { CalculationStore } from '../../core/state/calculation-store';

export { RECALCULATE_DELAY_MS } from '../../core/state/latest-request';

/** The calculator's state, shared by the form, the result tabs and other pages. */
@Injectable({ providedIn: 'root' })
export class CalculatorStore extends CalculationStore<AmortizationRequest, AmortizationResponse> {
  private readonly api = inject(AmortizationApiService);

  readonly kind = 'Purchase';
  readonly route = ['/calculator', 'overview'];

  /** Whether the headline numbers are on screen; when they are not, phones show a compact summary bar. */
  readonly headlineVisible = signal(false);

  describe = describeInputs;
  suggestName = suggestName;

  protected send$(request: AmortizationRequest) {
    return this.api.calculate(request);
  }
}
