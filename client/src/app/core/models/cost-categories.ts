import { HousingCosts } from './amortization.models';

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
  { key: 'schoolTax', label: 'School tax', color: '--series-2' },
  { key: 'propertyTax', label: 'County & city tax', color: '--series-3' },
  { key: 'mudTax', label: 'MUD tax', color: '--series-4' },
  { key: 'pidAssessment', label: 'PID assessment', color: '--series-5' },
  { key: 'homeownersInsurance', label: 'Home insurance', color: '--series-6' },
  { key: 'mortgageInsurance', label: 'PMI', color: '--series-7' },
  { key: 'hoaDues', label: 'HOA dues', color: '--series-8' },
];
