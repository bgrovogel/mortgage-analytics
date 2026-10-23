import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { formatMonths } from '../../../core/formatting/duration';
import { money, monthOf, pct, usd, usdCents } from '../../../core/formatting/format';
import { DetailTab, DetailTabsComponent } from '../../../core/layout/detail-tabs.component';
import { RefinanceOption, RefinanceResponse } from '../../../core/models/refinance.models';
import { RateWhatIfComponent } from '../../calculator/rate-what-if/rate-what-if.component';
import { RefinanceChartComponent } from '../refinance-chart/refinance-chart.component';
import { TPipe } from '../../../core/i18n/t.pipe';
import { t, tp } from '../../../core/i18n/i18n';

/** "7 years", or "1 year". */
const yearsOf = (years: number): string => tp(years, '{n} year', '{n} years');

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
  imports: [DetailTabsComponent, RateWhatIfComponent, RefinanceChartComponent, TPipe],
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

  /** The detail view shown: the options side by side, the balances over time, or the new loan at other rates. */
  protected readonly tab = signal<string>('table');

  /** The views the details have; the rate what-if only when the new loan has one rate to vary. */
  protected readonly tabs = computed<readonly DetailTab[]>(() => [
    { value: 'table', label: t('Side by side') },
    { value: 'time', label: t('Over time') },
    ...(this.rateLoan() ? [{ value: 'rate', label: t('If the rate changes') }] : []),
  ]);

  protected readonly dollars = usd;
  protected readonly cents = usdCents;
  protected readonly money = money;
  protected readonly date = monthOf;
  protected readonly pct = pct;
  protected readonly months = formatMonths;

  /**
   * What the rates do from here: each loan's resets (an adjustable rate), a buydown on the new loan and what it
   * costs, and, when either loan adjusts, the lifetime result if rates rise as far as the caps allow. Null for two
   * fixed rates.
   */
  readonly rates = computed(() => {
    const r = this.result();
    const resets = (option: RefinanceOption, loan: string) => option.rateChanges.map((c) =>
      t('{0} resets from {1}: {2} → {3}, {4} → {5} a month.', [loan, monthOf(c.effectiveDate), pct(c.previousRate), pct(c.newRate), usdCents(c.previousPayment), usdCents(c.newPayment)]));
    const lines = [...resets(r.current, t('Your loan')), ...resets(r.refinanced, t('The new loan'))];
    const b = r.newBuydown;
    const buydown = b
      ? t('The {0} buydown costs {1} at closing (in the cash at closing) and pays it back as lower payments: {2}. It changes when you pay, not how much.', [
          b.years.slice(0, -1).map((y) => Math.round((b.noteRate - y.annualInterestRate) * 100) / 100).join('-'),
          usd(r.buydownCost),
          b.years.map((y, i) => (i === b.years.length - 1 ? t('{0} from year {1}', [usdCents(y.monthlyPayment), y.year]) : t('{0} in year {1}', [usdCents(y.monthlyPayment), y.year]))).join(', '),
        ])
      : null;
    const worst = r.worstCaseLifetimeSavings;
    let worstCase: string | null = null;
    if (worst !== null) {
      const args = [usd(Math.abs(worst)), usd(Math.abs(r.lifetimeSavings))];
      if (worst >= 0) {
        worstCase = r.lifetimeSavings >= 0
          ? t('If rates rise as far as the caps allow, refinancing would save {0} over the life of the loan (on the path you expect, it saves {1}).', args)
          : t('If rates rise as far as the caps allow, refinancing would save {0} over the life of the loan (on the path you expect, it costs {1}).', args);
      } else {
        worstCase = r.lifetimeSavings >= 0
          ? t('If rates rise as far as the caps allow, refinancing would cost {0} over the life of the loan (on the path you expect, it saves {1}).', args)
          : t('If rates rise as far as the caps allow, refinancing would cost {0} over the life of the loan (on the path you expect, it costs {1}).', args);
      }
    }
    return lines.length > 0 || buydown || worstCase ? { resets: lines, buydown, worstCase } : null;
  });

  /** True when either loan carries PMI, which then counts in the payments, the totals and the break-even. */
  readonly hasPmi = computed(() => this.result().current.totalPmi > 0 || this.result().refinanced.totalPmi > 0);

  /** True while the verdict shows the refinance with today's payment kept (the switch in "Keep paying"). */
  readonly keeping = signal(false);

  /** The new loan as the verdict shows it: as asked, or with today's payment kept, when that is on. */
  protected readonly option = computed(() => {
    const r = this.result();
    return this.keeping() && r.keepingCurrentPayment ? r.keepingCurrentPayment : r.refinanced;
  });

  /** What the verdict says it saves over the life of the loan: of the new loan, or with today's payment kept. */
  protected readonly lifetime = computed(() => {
    const r = this.result();
    return this.keeping() && r.keepingCurrentPayment ? (r.keepingCurrentPaymentLifetimeSavings ?? 0) : r.lifetimeSavings;
  });

  /** The switch in "Keep paying": the verdict shows the refinance with today's payment kept, or as asked. */
  protected setKeeping(event: Event): void {
    this.keeping.set((event.target as HTMLInputElement).checked);
  }

  /** True when the verdict is that refinancing costs more over the life of the loan, closing costs included. */
  readonly costsMore = computed(() => this.lifetime() < 0);

  /** True when today's payment is kept in the verdict, so the payment is the one paid now. */
  protected readonly keepsPayment = computed(() => this.keeping() && !!this.result().keepingCurrentPayment);

  /** What the cash in hand is made of: the cash out, less what is paid at closing. */
  readonly cashDetail = computed(() => {
    const r = this.result();
    return r.upfrontCosts > 0
      ? t('{0} out, less {1} paid at closing', [usd(r.cashOut), usd(r.upfrontCosts)])
      : t('{0} out, nothing paid at closing', [usd(r.cashOut)]);
  });

  /** Where the new loan stands against the most a cash-out refinance may borrow; null without cash out or a home value. */
  readonly cashLimit = computed(() => {
    const r = this.result();
    if (r.cashOut <= 0 || r.newLoanToValuePercent === null) return null;
    const share = pct(r.newLoanToValuePercent);
    return r.exceedsCashOutLimit
      ? t("The new loan is {0} of the home's value. Lenders cap a cash-out refinance at 80%, so this one may not be offered.", [share])
      : t("The new loan is {0} of the home's value, within the 80% a cash-out refinance allows.", [share]);
  });

  /** The home-equity loan compared with the cash-out refinance, or null when the request did not ask for it. */
  protected readonly equity = computed(() => this.result().homeEquity ?? null);

  /** Paying off a debt with the cash against keeping it, or null when the request asked for none. */
  protected readonly debt = computed(() => this.result().debtPayoff ?? null);

  /** What paying the debt off does to the cost over the years kept, and to the monthly payments while the debt would have lasted. */
  readonly debtVerdict = computed(() => {
    const d = this.debt();
    if (!d) return null;
    const args = [usd(d.balance), usd(Math.abs(d.savedByPayingOff)), yearsOf(d.yearsKept)];
    const cost = d.savedByPayingOff >= 0
      ? t('Paying off the {0} debt with the cash costs {1} less over {2} than keeping it.', args)
      : t('Paying off the {0} debt with the cash costs {1} more over {2} than keeping it.', args);
    const monthly = [usdCents(Math.abs(d.monthlyChange)), formatMonths(d.monthsToPayOff)];
    return `${cost} ${d.monthlyChange >= 0
      ? t('Each month you pay {0} less while the debt would have lasted ({1}).', monthly)
      : t('Each month you pay {0} more while the debt would have lasted ({1}).', monthly)}`;
  });

  /** Why a lower payment is not the whole answer: the debt would be gone sooner than the mortgage it is moved onto. */
  readonly debtSpread = computed(() => {
    const d = this.debt();
    return d ? t('Kept, the debt is gone in {0}. Paid off with the cash out, it is spread over the new loan, which runs {1}.', [formatMonths(d.monthsToPayOff), formatMonths(this.result().refinanced.numberOfPayments)]) : null;
  });

  /** What the new loan's discount points are worth, or null when none were bought. */
  protected readonly points = computed(() => this.result().points ?? null);

  /** What the points say: what they cost, the lower payment they buy, and when they pay for themselves, if they do. */
  readonly pointsVerdict = computed(() => {
    const p = this.points();
    if (!p) return null;
    const args = [tp(p.points, '{n} point', '{n} points'), usd(p.cost), usdCents(p.monthlySaving)];
    return p.breakEvenPayment === null || p.breakEvenDate === null
      ? t('Buying {0} for {1} lowers the payment by {2} a month, but the interest saved never covers what they cost.', args)
      : t('Buying {0} for {1} lowers the payment by {2} a month. They pay for themselves after {3} payments ({4}); keep the loan longer than that and they save you money.',
        [...args, p.breakEvenPayment, monthOf(p.breakEvenDate)]);
  });

  /** What the comparison says: which way costs less over the years kept, and by how much. */
  readonly equityVerdict = computed(() => {
    const e = this.equity();
    if (!e) return null;
    const saved = e.savedByEquityLoan;
    const args = [usd(e.amount), usd(Math.abs(saved)), yearsOf(e.yearsKept)];
    if (e.drawPeriodInMonths > 0) {
      return saved >= 0
        ? t('Keeping your loan and borrowing {0} on a home-equity line costs {1} less over {2} than refinancing.', args)
        : t('Keeping your loan and borrowing {0} on a home-equity line costs {1} more over {2} than refinancing.', args);
    }
    return saved >= 0
      ? t('Keeping your loan and borrowing {0} separately costs {1} less over {2} than refinancing.', args)
      : t('Keeping your loan and borrowing {0} separately costs {1} more over {2} than refinancing.', args);
  });

  /** For a line of credit, how long it is interest only, what it is repaid at after, and that its rate is an expectation; null for a loan. */
  readonly equityLineNote = computed(() => {
    const e = this.equity();
    if (!e || e.drawPeriodInMonths <= 0) return null;
    return `${t('The line is interest only for {0}, then {1} a month for {2} at {3}.', [
      formatMonths(e.drawPeriodInMonths), usdCents(e.repaymentPayment), formatMonths(e.termInMonths), pct(e.repaymentRate),
    ])} ${t("A line's rate moves with the market, so this rests on the rate you expect once it is being repaid.")}`;
  });

  /** How much could be borrowed against the home and where the loans together stand against the 80% lenders allow; null without a home value. */
  readonly equityLimit = computed(() => {
    const e = this.equity();
    if (!e || e.availableEquity === null || e.combinedLoanToValuePercent === null) return null;
    const args = [usd(e.availableEquity), pct(e.combinedLoanToValuePercent)];
    return e.exceedsLimit
      ? t("You could borrow up to {0} against your home. With this cash, your loans would be {1} of its value, above the 80% lenders allow, so this may not be offered.", args)
      : t("You could borrow up to {0} against your home. With this cash, your loans would be {1} of its value, within the 80% lenders allow.", args);
  });

  /** One sentence on the payment and the term, e.g. "The payment drops $321.69 a month, but the loan runs 5 yr longer." */
  readonly paymentSentence = computed(() => {
    const r = this.result();
    if (this.keepsPayment()) {
      const keep = r.keepingCurrentPayment!;
      return t('The payment stays at {0}, and the extra {1} a month goes to principal, so it is paid off {2} sooner.', [
        usdCents(r.current.monthlyPayment + r.current.monthlyPmi), usdCents(keep.extraMonthlyPrincipal), formatMonths(this.keepingMonthsSooner()),
      ]);
    }
    if (r.monthlySavings >= 0) {
      return r.monthsAdded > 0
        ? t('The payment drops {0} a month, but the loan runs {1} longer.', [usdCents(r.monthlySavings), formatMonths(r.monthsAdded)])
        : t('The payment drops {0} a month.', [usdCents(r.monthlySavings)]);
    }
    return r.monthsAdded > 0
      ? t('The payment rises {0} a month, but the loan runs {1} longer.', [usdCents(-r.monthlySavings), formatMonths(r.monthsAdded)])
      : t('The payment rises {0} a month.', [usdCents(-r.monthlySavings)]);
  });

  /** "5 yr later than now (Dec 2050)", "1 yr 2 mo sooner than now", or "same as now". */
  readonly payoffChange = computed(() => {
    const r = this.result();
    if (this.keepsPayment()) return t('{0} sooner than now', [formatMonths(this.keepingMonthsSooner())]);
    if (r.monthsAdded > 0) return t('{0} later than now ({1})', [formatMonths(r.monthsAdded), monthOf(r.current.payoffDate)]);
    if (r.monthsAdded < 0) return t('{0} sooner than now', [formatMonths(-r.monthsAdded)]);
    return t('same as now');
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
    const closing = r.upfrontCosts > 0 ? usd(r.upfrontCosts) : financed > 0 ? t('{0} in the loan', [usd(financed)]) : '$0';
    const columns: TableColumn[] = [
      { label: t('Keep current loan'), option: r.current, closing: '—', totalCost: r.current.totalPaid + r.current.totalPmi },
      { label: t('Refinance'), option: r.refinanced, closing, totalCost: r.refinanced.totalPaid + r.refinanced.totalPmi + r.upfrontCosts },
    ];
    if (r.keepingCurrentPayment) {
      const keep = r.keepingCurrentPayment;
      columns.push({ label: t('Refinance, keep payment'), option: keep, closing, totalCost: keep.totalPaid + keep.totalPmi + r.upfrontCosts });
    }
    return columns;
  });
}
