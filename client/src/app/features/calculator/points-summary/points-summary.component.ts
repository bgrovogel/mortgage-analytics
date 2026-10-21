import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { decimal, monthOf, pct, usd, usdCents } from '../../../core/formatting/format';
import { AmortizationResponse } from '../../../core/models/amortization.models';
import { TPipe } from '../../../core/i18n/t.pipe';

/**
 * Whether discount points pay: the payment without them beside the payment with them, what they cost, when the
 * interest they save covers that, and what they save over the loan, or that they never pay for themselves. Shows
 * nothing without points. It looks like the rate plan beside it, so it shares that panel's styles.
 */
@Component({
  imports: [TPipe],
  selector: 'app-points-summary',
  template: `
    @if (summary(); as s) {
      <section class="panel" data-testid="points-summary">
        <h3>{{ 'Discount points' | t }}</h3>
        <ol class="steps">
          <li><span class="when">{{ 'Without points' | t }}</span><span class="rate">{{ s.rateWithout }}</span><strong>{{ '{0}/mo' | t: [s.paymentWithout] }}</strong></li>
          <li><span class="when">{{ 'With {0}' | t: [s.count] }}</span><span class="rate">{{ s.rateWith }}</span><strong>{{ '{0}/mo' | t: [s.paymentWith] }}</strong></li>
        </ol>
        <p class="note" data-testid="points-verdict">{{ s.verdict }}</p>
      </section>
    }
  `,
  styleUrl: '../rate-plan/rate-plan.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PointsSummaryComponent {
  /** The analysis, which has the points' comparison when there are any. */
  readonly result = input.required<AmortizationResponse>();

  /** The two payments and the verdict, or null without points. */
  readonly summary = computed(() => {
    const result = this.result();
    const p = result.discountPoints;
    if (!p) return null;

    const one = p.points === 1;
    const count = `${decimal(p.points, 3)} point${one ? '' : 's'}`;
    const [it, its, costs, lowers] = one ? ['it', 'its', 'costs', 'lowers'] : ['they', 'their', 'cost', 'lower'];
    const opening = `${count} ${costs} ${usd(p.cost)} at closing and ${lowers} the payment ${usdCents(p.monthlySaving)} a month.`;
    const verdict = p.breakEvenPayment && p.breakEvenDate
      ? `${opening} The interest ${it} save${one ? 's' : ''} covers that by payment ${p.breakEvenPayment} (${monthOf(p.breakEvenDate)}), `
        + `and over the whole loan ${it} save${one ? 's' : ''} ${usd(p.netSaving)} after ${its} cost. Sell or refinance before then, `
        + `and ${it} cost${one ? 's' : ''} more than ${it} saved.`
      : `${opening} At this price ${it} never pay${one ? 's' : ''} for ${one ? 'itself' : 'themselves'}: over the whole loan ${it} `
        + `save${one ? 's' : ''} ${usd(p.interestSaved)} of interest, less than ${it} cost${one ? 's' : ''}.`;

    return {
      count,
      rateWithout: pct(p.rateWithoutPoints, 4),
      // The loan's own rate, the one the points buy: its first payment's.
      rateWith: pct(result.baseline.payments[0]?.annualInterestRate ?? 0, 4),
      paymentWithout: usdCents(p.paymentWithoutPoints),
      paymentWith: usdCents(p.paymentWithoutPoints - p.monthlySaving),
      verdict,
    };
  });
}
