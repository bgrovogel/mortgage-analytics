import { HousingCosts, LoanProgramType } from './amortization.models';

/** Display metadata for one housing-cost category. */
export interface CostCategory {
  /** The matching field on `HousingCosts`. */
  key: Exclude<keyof HousingCosts, 'total'>;
  label: string;
  /** CSS custom property holding the category's color. */
  color: string;
}

/**
 * Every housing-cost category in one fixed order, each with a fixed color, so a category looks
 * the same in every chart and never changes color when another category is absent.
 * Slot 1 (`--series-1`) is reserved for principal and interest.
 */
export const COST_CATEGORIES: readonly CostCategory[] = [
  // Property tax (one combined rate) and the separate taxes never appear together, so it shares school tax's slot.
  { key: 'propertyTax', label: 'Property tax', color: '--series-2' },
  { key: 'schoolTax', label: 'School tax', color: '--series-2' },
  { key: 'localTax', label: 'County & city tax', color: '--series-3' },
  { key: 'mudTax', label: 'MUD tax', color: '--series-4' },
  { key: 'pidAssessment', label: 'PID assessment', color: '--series-5' },
  { key: 'homeownersInsurance', label: 'Home insurance', color: '--series-6' },
  { key: 'mortgageInsurance', label: 'PMI', color: '--series-7' },
  { key: 'hoaDues', label: 'HOA dues', color: '--series-8' },
];

/** What a loan's mortgage insurance is called: MIP on an FHA loan, PMI otherwise (VA loans have none). */
export function mortgageInsuranceName(program: { type: LoanProgramType } | null | undefined): 'MIP' | 'PMI' {
  return program?.type === 'Fha' ? 'MIP' : 'PMI';
}

/** The categories for a loan: the same order and colors, with the mortgage insurance named for its program. */
export function costCategoriesFor(program: { type: LoanProgramType } | null | undefined): readonly CostCategory[] {
  return mortgageInsuranceName(program) === 'MIP'
    ? COST_CATEGORIES.map((c) => (c.key === 'mortgageInsurance' ? { ...c, label: 'FHA MIP' } : c))
    : COST_CATEGORIES;
}
