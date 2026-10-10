import { AmortizationRequest } from './amortization.models';

/** A calculation saved under a name (mirrors SavedCalculationResponse in the API). */
export interface SavedCalculation {
  id: string;
  name: string;
  inputs: AmortizationRequest;
  createdAt: string; // ISO date-time
  updatedAt: string; // ISO date-time
}
