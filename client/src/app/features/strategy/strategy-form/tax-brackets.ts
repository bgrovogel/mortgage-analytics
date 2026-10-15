import { TaxFilingStatus } from '../../../core/models/strategy.models';

/** What sets a household's federal bracket: its pay, how it files, and what comes off before tax. */
export interface TaxSituation {
  income: number;
  status: TaxFilingStatus;
  /** Pre-tax 401(k) contributions a year. */
  pretaxSavings: number;
  /** Itemized deductions other than mortgage interest a year. */
  otherDeductions: number;
  /** About a year of mortgage interest, which is itemized too. */
  yearOneInterest: number;
}

/**
 * 2026 standard deductions (IRS Rev. Proc. 2025-32), the same as the server's TaxDeductions. The tables are built in
 * functions, not as module constants, so each figure is exercised by the tests that call them.
 */
const standardDeduction = (status: TaxFilingStatus): number =>
  ({ Single: 16_100, MarriedFilingJointly: 32_200, HeadOfHousehold: 24_150 })[status];

/** 2026 ordinary income brackets (IRS Rev. Proc. 2025-32): the top of each, and its rate. */
const bracketsOf = (status: TaxFilingStatus): readonly (readonly [number, number])[] =>
  ({
    Single: [[12_400, 10], [50_400, 12], [105_700, 22], [201_775, 24], [256_225, 32], [640_600, 35], [Infinity, 37]],
    MarriedFilingJointly: [[24_800, 10], [100_800, 12], [211_400, 22], [403_550, 24], [512_450, 32], [768_700, 35], [Infinity, 37]],
    HeadOfHousehold: [[17_700, 10], [67_450, 12], [105_700, 22], [201_750, 24], [256_200, 32], [640_600, 35], [Infinity, 37]],
  } as const)[status];

/** 2026: the taxable income above which long-term gains are taxed 20% rather than 15%. */
const gains15Top = (status: TaxFilingStatus): number =>
  ({ Single: 545_500, MarriedFilingJointly: 613_700, HeadOfHousehold: 579_600 })[status];

/** The 3.8% net investment income tax applies above these incomes (set by law, not indexed). */
const niitThreshold = (status: TaxFilingStatus): number =>
  ({ Single: 200_000, MarriedFilingJointly: 250_000, HeadOfHousehold: 200_000 })[status];

/**
 * The household's 2026 federal bracket: on its income less pre-tax savings and the larger of the standard deduction
 * and its itemized deductions (other deductions plus a year of interest), as the server counts them.
 */
export function federalBracket(s: TaxSituation): { rate: number; taxableIncome: number; deductions: number } {
  const deductions = Math.max(standardDeduction(s.status), s.otherDeductions + s.yearOneInterest);
  const taxableIncome = Math.max(0, s.income - s.pretaxSavings - deductions);
  const rate = bracketsOf(s.status).find(([top]) => taxableIncome <= top)![1];
  return { rate, taxableIncome, deductions };
}

/**
 * The federal rate on long-term gains sold on top of this income: 15% for most (gains sold in one go rise past the
 * 0% band), 20% above the 15% bracket, and 3.8% more above the net investment income tax's threshold.
 */
export function longTermGainsRate(s: TaxSituation): number {
  const { taxableIncome } = federalBracket(s);
  const base = taxableIncome > gains15Top(s.status) ? 20 : 15;
  return s.income > niitThreshold(s.status) ? base + 3.8 : base;
}
