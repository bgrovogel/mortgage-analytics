import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { monthOf, pct, usd, usdCents } from '../../../core/formatting/format';
import { AmortizationResponse } from '../../../core/models/amortization.models';
import { buydownYears } from './buydown-years';

/** One line of the payment timeline: when, at what rate, and what principal and interest come to. */
interface Step {
  when: string;
  rate: string;
  payment: string;
}

/**
 * How the payment changes over the loan, when it does: a temporary buydown year by year (what you pay each month,
 * and what the buydown pays, then its whole cost), or
 * an adjustable rate's resets on the path you expect (and the worst case the caps allow). Shows nothing for a
 * fixed rate.
 */
@Component({
  selector: 'app-rate-plan',
  template: `
    @if (buydown(); as b) {
      <section class="panel" data-testid="rate-plan">
        <h3>{{ b.title }}</h3>
        <!-- Every year of it: what you pay each month (with that year's taxes and insurance), and what the buydown pays. -->
        <table class="years" data-testid="buydown-years">
          <thead>
            <tr><th scope="col">Year</th><th scope="col">Rate</th><th scope="col" class="num">Each month</th><th scope="col" class="num">Buydown pays</th></tr>
          </thead>
          <tbody>
            @for (y of b.rows; track y.label) {
              <tr>
                <th scope="row">{{ y.label }}</th>
                <td class="rate">{{ pct(y.rate) }}</td>
                <td class="num">
                  <strong>{{ usdCents(y.monthlyTotal) }}</strong>
                  @if (y.monthlyTotal !== y.loanPayment) {
                    &ngsp;<small>{{ usdCents(y.loanPayment) }} <abbr title="principal and interest">P&amp;I</abbr></small>
                  }
                </td>
                <td class="num">
                  @if (y.subsidy > 0) {
                    <strong>{{ usd(y.subsidy) }}</strong>&ngsp;<small>{{ usdCents(y.monthlySubsidy) }}/mo</small>
                  } @else {
                    <span class="none">Nothing</span>
                  }
                </td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr><th scope="row">In all</th><td></td><td></td><td class="num"><strong>{{ b.cost }}</strong></td></tr>
          </tfoot>
        </table>
        <p class="note" data-testid="buydown-cost">
          @if (b.sellerPays) {
            The seller or builder pays {{ b.cost }} up front to make up the difference. That money pays part of your early
            interest, so you pay {{ b.cost }} less interest over the loan.
          } @else {
            You pay {{ b.cost }} at closing to make up the difference, and get it back as lower payments over {{ b.years }}:
            it changes when you pay, not how much.
          }
          The loan itself is at {{ b.noteRate }} throughout, so its interest and payoff do not change.
        </p>
      </section>
    }
    @if (adjustable(); as a) {
      <section class="panel" data-testid="rate-plan">
        <h3>Adjustable rate</h3>
        <ol class="steps">
          @for (step of a.steps; track step.when) {
            <li><span class="when">{{ step.when }}</span><span class="rate">{{ step.rate }}</span><strong>{{ step.payment }}</strong></li>
          }
        </ol>
        <p class="note warning" data-testid="arm-worst-case">{{ a.worstCase }}</p>
      </section>
    }
  `,
  styleUrl: './rate-plan.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RatePlanComponent {
  protected readonly pct = pct;
  protected readonly usd = usd;
  protected readonly usdCents = usdCents;

  /** The analysis to describe. */
  readonly result = input.required<AmortizationResponse>();

  /** A buydown's years, then the note rate; null without a buydown. */
  readonly buydown = computed(() => {
    const b = this.result().buydown;
    if (!b) return null;
    const last = b.years.length;
    return {
      title: `${b.years.slice(0, -1).map((y) => decimalPoints(b.noteRate - y.annualInterestRate)).join('-')} buydown`,
      rows: buydownYears(this.result())!,
      cost: usd(b.totalSubsidy),
      noteRate: pct(b.noteRate),
      sellerPays: b.paidBy === 'Seller',
      years: last - 1 === 1 ? '1 year' : `${last - 1} years`,
    };
  });

  /** An adjustable rate's resets on the path you expect, and its worst case; null for a fixed rate. */
  readonly adjustable = computed(() => {
    const r = this.result();
    const worst = r.adjustableRate;
    if (!worst) return null;
    const schedule = r.accelerated;
    const first = schedule.payments[0];
    const changes = schedule.rateChanges;
    const steps: Step[] = [
      {
        when: changes.length > 0 ? `${monthOf(first.dueDate)} to ${monthOf(previousMonth(changes[0].effectiveDate))}` : 'The whole loan',
        rate: pct(first.annualInterestRate),
        payment: `${usdCents(schedule.monthlyPayment)}/mo`,
      },
      ...changes.map((c): Step => ({ when: `From ${monthOf(c.effectiveDate)}`, rate: pct(c.newRate), payment: `${usdCents(c.newPayment)}/mo` })),
    ];
    const peak = worst.worstCaseRateChanges.at(-1);
    const worstCase = peak
      ? `If rates rise as far as the caps allow, the rate reaches ${pct(peak.newRate)} by ${monthOf(peak.effectiveDate)} and the payment `
        + `${usdCents(worst.worstCasePeakPayment)} a month (without extra payments): ${usd(worst.worstCaseTotalInterest)} of interest over the `
        + `loan, against ${usd(r.baseline.totalInterest)} on the path you expect.`
      : 'The caps allow no change in the rate, so this works like a fixed rate.';
    return { steps, worstCase };
  });
}

/** 2 becomes "2", 1.5 becomes "1.5": a buydown's points, as its name writes them. */
function decimalPoints(points: number): string {
  return String(Math.round(points * 100) / 100);
}

/** The month before a yyyy-MM-dd date, as yyyy-MM-dd: when the old rate's last payment fell. */
function previousMonth(isoDate: string): string {
  const [year, month] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 2, 1));
  return date.toISOString().slice(0, 10);
}
