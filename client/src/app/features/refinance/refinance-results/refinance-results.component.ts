import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatMonths } from '../../../core/formatting/duration';
import { money, monthOf, usd, usdCents } from '../../../core/formatting/format';
import { RefinanceOption, RefinanceResponse } from '../../../core/models/refinance.models';
import { RefinanceChartComponent } from '../refinance-chart/refinance-chart.component';


/** One column of the comparison table. */
interface TableColumn {
  label: string;
  option: RefinanceOption;
  /** Cash at closing, or a note that the costs are in the loan. */
  closing: string;
  /** Everything paid: principal, interest and cash at closing. */
  totalCost: number;
}

/**
 * Presentational: what a refinance does, in plain words first (does it save or cost money overall?),
 * then the numbers behind it. When the new loan runs longer it explains the restarted amortization
 * clock, and shows the way around it: keep paying today's payment on the new loan.
 */
@Component({
  selector: 'app-refinance-results',
  imports: [RefinanceChartComponent],
  templateUrl: './refinance-results.component.html',
  styleUrl: './refinance-results.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RefinanceResultsComponent {
  /** The comparison to show. */
  readonly result = input.required<RefinanceResponse>();

  protected readonly dollars = usd;
  protected readonly cents = usdCents;
  protected readonly money = money;
  protected readonly date = monthOf;
  protected readonly months = formatMonths;

  /** True when refinancing costs more over the life of the loan, closing costs included. */
  readonly costsMore = computed(() => this.result().lifetimeSavings < 0);

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
    const financed = r.refinanced.loanAmount - r.current.loanAmount;
    const closing = r.upfrontCosts > 0 ? usd(r.upfrontCosts) : financed > 0 ? `${usd(financed)} in the loan` : '$0';
    const columns: TableColumn[] = [
      { label: 'Keep current loan', option: r.current, closing: '—', totalCost: r.current.totalPaid },
      { label: 'Refinance', option: r.refinanced, closing, totalCost: r.refinanced.totalPaid + r.upfrontCosts },
    ];
    if (r.keepingCurrentPayment) {
      columns.push({ label: 'Refinance, keep payment', option: r.keepingCurrentPayment, closing, totalCost: r.keepingCurrentPayment.totalPaid + r.upfrontCosts });
    }
    return columns;
  });
}
