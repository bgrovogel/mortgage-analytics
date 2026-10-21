import { HousingCosts, LoanProgramType } from './amortization.models';
import { t } from '../i18n/i18n';

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
  { key: 'propertyTax', get label() { return t('Property tax'); }, color: '--series-2' },
  { key: 'schoolTax', get label() { return t('School tax'); }, color: '--series-2' },
  { key: 'localTax', get label() { return t('County & city tax'); }, color: '--series-3' },
  { key: 'mudTax', get label() { return t('MUD tax'); }, color: '--series-4' },
  { key: 'pidAssessment', get label() { return t('PID assessment'); }, color: '--series-5' },
  { key: 'homeownersInsurance', get label() { return t('Home insurance'); }, color: '--series-6' },
  { key: 'mortgageInsurance', get label() { return t('PMI'); }, color: '--series-7' },
  { key: 'hoaDues', get label() { return t('HOA dues'); }, color: '--series-8' },
];

/** What a loan's mortgage insurance is called: MIP on an FHA loan, PMI otherwise (VA loans have none). */
export function mortgageInsuranceName(program: { type: LoanProgramType } | null | undefined): 'MIP' | 'PMI' {
  return program?.type === 'Fha' ? 'MIP' : 'PMI';
}

/** The categories for a loan: the same order and colors, with the mortgage insurance named for its program. */
export function costCategoriesFor(program: { type: LoanProgramType } | null | undefined): readonly CostCategory[] {
  return mortgageInsuranceName(program) === 'MIP'
    ? COST_CATEGORIES.map((c) => (c.key === 'mortgageInsurance' ? { ...c, get label() { return t('FHA MIP'); } } : c))
    : COST_CATEGORIES;
}
