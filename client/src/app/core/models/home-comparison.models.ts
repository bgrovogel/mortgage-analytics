import { AmortizationRequest, AmortizationResponse } from './amortization.models';

/**
 * Two homes compared, each a full calculator request: any input can differ. The API calculates each on its own;
 * saved, the first is a calculation's `inputs` and the second its `secondHome`.
 */
export interface HomeComparisonRequest {
  first: AmortizationRequest;
  second: AmortizationRequest;
}

/** The calculator's results for each home. */
export interface HomeComparisonResponse {
  first: AmortizationResponse;
  second: AmortizationResponse;
}
