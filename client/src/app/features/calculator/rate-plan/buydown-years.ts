import { toCents } from '../../../core/loans/loan-progress';
import { AmortizationResponse } from '../../../core/models/amortization.models';

/** One year of a buydown, as the page shows it. */
export interface BuydownYearView {
  /** "Year 1", or "From year 3" for the first year at the note rate. */
  label: string;
  rate: number;
  /** The principal and interest paid each month that year. */
  loanPayment: number;
  /** Everything paid each month that year: principal and interest, with that year's taxes, insurance, PMI and HOA. */
  monthlyTotal: number;
  /** What the buydown pays each month that year: the note-rate payment less this year's. */
  monthlySubsidy: number;
  /** What the buydown pays that year. */
  subsidy: number;
}

/**
 * A buydown year by year: every payment the borrower makes while it lasts, and what the buydown pays in each year,
 * so no year is left out. Housing costs are each year's own (taxes and insurance rise), from the standard schedule.
 * Null without a buydown.
 */
export function buydownYears(r: AmortizationResponse): BuydownYearView[] | null {
  const b = r.buydown;
  if (!b) return null;
  const last = b.years[b.years.length - 1];
  const housingIn = (year: number) => r.baseline.payments[(year - 1) * 12]?.housingCosts ?? r.baseline.monthlyHousingCosts.total;
  return b.years.map((y) => ({
    label: y.year === last.year ? `From year ${y.year}` : `Year ${y.year}`,
    rate: y.annualInterestRate,
    loanPayment: y.monthlyPayment,
    monthlyTotal: toCents(y.monthlyPayment + housingIn(y.year)),
    monthlySubsidy: toCents(last.monthlyPayment - y.monthlyPayment),
    subsidy: y.subsidy,
  }));
}
