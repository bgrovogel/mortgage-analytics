import { AmortizationRequest } from './amortization.models';
import { HomeComparisonRequest } from './home-comparison.models';
import { RefinanceRequest } from './refinance.models';
import { StrategyRequest } from './strategy.models';

/** What a saved calculation holds: calculator inputs, homes compared, a refinance or a pay-off-or-invest comparison. */
export type SavedCalculationKind = 'Purchase' | 'HomeComparison' | 'Refinance' | 'Strategy';

/** The inputs to save: one kind (mirrors SaveCalculationRequest in the API, minus the name). */
export type SavedInputs =
  | { inputs: AmortizationRequest; otherHomes?: never; refinance?: never; strategy?: never }
  | { inputs: AmortizationRequest; otherHomes: AmortizationRequest[]; refinance?: never; strategy?: never }
  | { refinance: RefinanceRequest; inputs?: never; otherHomes?: never; strategy?: never }
  | { strategy: StrategyRequest; inputs?: never; otherHomes?: never; refinance?: never };

/** A calculation saved under a name (mirrors SavedCalculationResponse in the API). */
export interface SavedCalculation {
  id: string;
  name: string;
  /** A few words to remind its owner what it was for, up to 500 characters; null or left out for none. */
  note?: string | null;
  kind: SavedCalculationKind;
  /** Set for a purchase calculation, and for the first of the homes compared. */
  inputs: AmortizationRequest | null;
  /** Set for homes compared: every home after the first, one to three. */
  otherHomes: AmortizationRequest[] | null;
  /** Set for a refinance comparison. */
  refinance: RefinanceRequest | null;
  /** Set for a pay-off-or-invest comparison. */
  strategy: StrategyRequest | null;
  createdAt: string; // ISO date-time
  updatedAt: string; // ISO date-time
}

/** The field that holds each kind's inputs, for the kinds that are one request. */
const FIELD = { Purchase: 'inputs', Refinance: 'refinance', Strategy: 'strategy' } as const;

/** What to send to save a kind's request, e.g. `{ refinance: request }`; a comparison's first home and the rest go in two fields. */
export function savedInputsFor(kind: SavedCalculationKind, request: unknown): SavedInputs {
  if (kind === 'HomeComparison') {
    const [first, ...others] = (request as HomeComparisonRequest).homes;
    return { inputs: first, otherHomes: others };
  }
  return { [FIELD[kind]]: request } as unknown as SavedInputs;
}

/** The request a saved calculation was saved from, ready to send to its page again. */
export function requestOf(calculation: SavedCalculation): unknown {
  return calculation.kind === 'HomeComparison'
    ? { homes: [calculation.inputs, ...(calculation.otherHomes ?? [])] } satisfies Partial<Record<keyof HomeComparisonRequest, unknown>>
    : calculation[FIELD[calculation.kind]];
}

/** The saved inputs of a calculation, ready to save again (e.g. under a new name). */
export function savedInputsOf(calculation: SavedCalculation): SavedInputs {
  return savedInputsFor(calculation.kind, requestOf(calculation));
}
