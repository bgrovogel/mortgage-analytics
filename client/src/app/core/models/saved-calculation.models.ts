import { AmortizationRequest } from './amortization.models';
import { RefinanceRequest } from './refinance.models';

/** What a saved calculation holds: calculator inputs, or a refinance comparison. */
export type SavedCalculationKind = 'Purchase' | 'Refinance';

/** The inputs to save: exactly one kind (mirrors SaveCalculationRequest in the API, minus the name). */
export type SavedInputs = { inputs: AmortizationRequest; refinance?: never } | { refinance: RefinanceRequest; inputs?: never };

/** A calculation saved under a name (mirrors SavedCalculationResponse in the API). */
export interface SavedCalculation {
  id: string;
  name: string;
  kind: SavedCalculationKind;
  /** Set for a purchase calculation. */
  inputs: AmortizationRequest | null;
  /** Set for a refinance comparison. */
  refinance: RefinanceRequest | null;
  createdAt: string; // ISO date-time
  updatedAt: string; // ISO date-time
}

/** The saved inputs of a calculation, ready to save again (e.g. under a new name). */
export function savedInputsOf(calculation: SavedCalculation): SavedInputs {
  return calculation.inputs ? { inputs: calculation.inputs } : { refinance: calculation.refinance! };
}
