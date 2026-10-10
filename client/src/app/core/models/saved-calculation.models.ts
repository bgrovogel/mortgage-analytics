import { AmortizationRequest } from './amortization.models';
import { RefinanceRequest } from './refinance.models';
import { StrategyRequest } from './strategy.models';

/** What a saved calculation holds: calculator inputs, a refinance comparison, or a pay-off-or-invest comparison. */
export type SavedCalculationKind = 'Purchase' | 'Refinance' | 'Strategy';

/** The inputs to save: exactly one kind (mirrors SaveCalculationRequest in the API, minus the name). */
export type SavedInputs =
  | { inputs: AmortizationRequest; refinance?: never; strategy?: never }
  | { refinance: RefinanceRequest; inputs?: never; strategy?: never }
  | { strategy: StrategyRequest; inputs?: never; refinance?: never };

/** A calculation saved under a name (mirrors SavedCalculationResponse in the API). */
export interface SavedCalculation {
  id: string;
  name: string;
  kind: SavedCalculationKind;
  /** Set for a purchase calculation. */
  inputs: AmortizationRequest | null;
  /** Set for a refinance comparison. */
  refinance: RefinanceRequest | null;
  /** Set for a pay-off-or-invest comparison. */
  strategy: StrategyRequest | null;
  createdAt: string; // ISO date-time
  updatedAt: string; // ISO date-time
}

/** The saved inputs of a calculation, ready to save again (e.g. under a new name). */
export function savedInputsOf(calculation: SavedCalculation): SavedInputs {
  if (calculation.inputs) return { inputs: calculation.inputs };
  if (calculation.refinance) return { refinance: calculation.refinance };
  return { strategy: calculation.strategy! };
}
