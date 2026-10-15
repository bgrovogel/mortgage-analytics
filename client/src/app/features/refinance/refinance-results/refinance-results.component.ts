import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatMonths } from '../../../core/formatting/duration';
import { money, monthOf, pct, usd, usdCents } from '../../../core/formatting/format';
import { RefinanceOption, RefinanceResponse } from '../../../core/models/refinance.models';
import { RateWhatIfComponent } from '../../calculator/rate-what-if/rate-what-if.component';
import { RefinanceChartComponent } from '../refinance-chart/refinance-chart.component';

/** One column of the comparison table. */
interface TableColumn {
  label: string;
  option: RefinanceOption;
  /** Cash at closing, or a note that the costs are in the loan. */
  closing: string;
  /** Everything paid: principal, interest, PMI and cash at closing. */
  totalCost: number;
}

/**
 * Presentational: what a refinance does, in plain words first (does it save or cost money overall?),
 * then the numbers behind it. When the new loan runs longer it explains the restarted amortization
 * clock, and shows the way around it: keep paying today's payment on the new loan.
 */
@Component({
  selector: 'app-refinance-results',
  imports: [RateWhatIfComponent, RefinanceChartComponent],
  templateUrl: './refinance-results.component.html',
  styleUrl: './refinance-results.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RefinanceResultsComponent {
  /** The comparison to show. */
  readonly result = input.required<RefinanceResponse>();

  /** The rate the new loan was asked at, for the what-if; null leaves the what-if out. */
  readonly newRate = input<number | null>(null);

  /** The new loan, priced at other rates: none for an adjustable rate or a buydown, whose rate is not one number. */
  protected readonly rateLoan = computed(() => {
    const r = this.result();
    const rate = this.newRate();
    if (rate === null || r.newBuydown || r.refinanced.rateChanges.length > 0 || r.refinanced.loanAmount <= 0) return null;
    return { amount: r.refinanced.loanAmount, rate, termMonths: r.refinanced.numberOfPayments };
  });

  protected readonly dollars = usd;
  protected readonly cents = usdCents;
  protected readonly money = money;
  protected readonly date = monthOf;
  protected readonly months = formatMonths;

  /**
   * What the rates do from here: each loan's resets (an adjustable rate), a buydown on the new loan and what it
   * costs, and, when either loan adjusts, the lifetime result if rates rise as far as the caps allow. Null for two
   * fixed rates.
   */
  readonly rates = computed(() => {
    const r = this.result();
    const resets = (option: RefinanceOption, loan: string) => option.rateChanges.map((c) =>
      `${loan} resets from ${monthOf(c.effectiveDate)}: ${pct(c.previousRate)} → ${pct(c.newRate)}, ${usdCents(c.previousPayment)} → ${usdCents(c.newPayment)} a month.`);
    const lines = [...resets(r.current, 'Your loan'), ...resets(r.refinanced, 'The new loan')];
    const b = r.newBuydown;
    const buydown = b
      ? `The ${b.years.slice(0, -1).map((y) => Math.round((b.noteRate - y.annualInterestRate) * 100) / 100).join('-')} buydown costs `
        + `${usd(r.buydownCost)} at closing (in the cash at closing) and pays it back as lower payments: `
        + `${b.years.map((y, i) => `${usdCents(y.monthlyPayment)}${i === b.years.length - 1 ? ` from year ${y.year}` : ` in year ${y.year}`}`).join(', ')}. `
        + 'It changes when you pay, not how much.'
      : null;
    const worst = r.worstCaseLifetimeSavings;
    const worstCase = worst === null
      ? null
      : `If rates rise as far as the caps allow, refinancing would ${worst >= 0 ? 'save' : 'cost'} ${usd(Math.abs(worst))} over the life of the loan`
        + ` (on the path you expect, it ${r.lifetimeSavings >= 0 ? 'saves' : 'costs'} ${usd(Math.abs(r.lifetimeSavings))}).`;
    return lines.length > 0 || buydown || worstCase ? { resets: lines, buydown, worstCase } : null;
  });

  /** True when either loan carries PMI, which then counts in the payments, the totals and the break-even. */
  readonly hasPmi = computed(() => this.result().current.totalPmi > 0 || this.result().refinanced.totalPmi > 0);

  /** True when refinancing costs more over the life of the loan, closing costs included. */
  readonly costsMore = computed(() => this.result().lifetimeSavings < 0);

  /** What the cash in hand is made of: the cash out, less what is paid at closing. */
  readonly cashDetail = computed(() => {
    const r = this.result();
    return r.upfrontCosts > 0
      ? `${usd(r.cashOut)} out, less ${usd(r.upfrontCosts)} paid at closing`
      : `${usd(r.cashOut)} out, nothing paid at closing`;
  });

  /** Where the new loan stands against the most a cash-out refinance may borrow; null without cash out or a home value. */
  readonly cashLimit = computed(() => {
    const r = this.result();
    if (r.cashOut <= 0 || r.newLoanToValuePercent === null) return null;
    const share = `The new loan is ${pct(r.newLoanToValuePercent)} of the home's value`;
    return r.exceedsCashOutLimit
      ? `${share}. Lenders cap a cash-out refinance at 80%, so this one may not be offered.`
      : `${share}, within the 80% a cash-out refinance allows.`;
  });

  /** One sentence on the payment and the term, e.g. "The payment drops $321.69 a month, but the loan runs 5 yr longer." */
  readonly paymentSentence = computed(() => {
    const r = this.result();
    const change = r.monthlySavings >= 0
      ? `The payment drops ${usdCents(r.monthlySavings)} a month`
      : `The payment rises ${usdCents(-r.monthlySavings)} a month`;
    return r.monthsAdded > 0 ? `${change}, but the loan runs ${formatMonths(r.monthsAdded)} longer.` : `${change}.`;
  });

  /** "5 yr later than now (Dec 2050)", "1 yr 2 mo sooner than now", or "same as now". */
  readonly payoffChange = computed(() => {
    const r = this.result();
    if (r.monthsAdded > 0) return `${formatMonths(r.monthsAdded)} later than now (${monthOf(r.current.payoffDate)})`;
    if (r.monthsAdded < 0) return `${formatMonths(-r.monthsAdded)} sooner than now`;
    return 'same as now';
  });

  /** Interest in the new loan's first payment: high again, because the clock restarted. */
  readonly firstInterest = computed(() => this.result().refinanced.payments[0]?.interest ?? 0);

  /** How much sooner keeping today's payment pays off than the current loan. */
  readonly keepingMonthsSooner = computed(() => {
    const r = this.result();
    return r.keepingCurrentPayment ? r.current.numberOfPayments - r.keepingCurrentPayment.numberOfPayments : 0;
  });

  /** The options side by side; the keep-payment column only when it applies. */
  readonly columns = computed<TableColumn[]>(() => {
    const r = this.result();
    const financed = r.refinanced.loanAmount - r.current.loanAmount - r.cashOut;
    const closing = r.upfrontCosts > 0 ? usd(r.upfrontCosts) : financed > 0 ? `${usd(financed)} in the loan` : '$0';
    const columns: TableColumn[] = [
      { label: 'Keep current loan', option: r.current, closing: '—', totalCost: r.current.totalPaid + r.current.totalPmi },
      { label: 'Refinance', option: r.refinanced, closing, totalCost: r.refinanced.totalPaid + r.refinanced.totalPmi + r.upfrontCosts },
    ];
    if (r.keepingCurrentPayment) {
      const keep = r.keepingCurrentPayment;
      columns.push({ label: 'Refinance, keep payment', option: keep, closing, totalCost: keep.totalPaid + keep.totalPmi + r.upfrontCosts });
    }
    return columns;
  });
}
