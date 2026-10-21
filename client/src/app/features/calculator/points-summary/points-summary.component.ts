import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { decimal, monthOf, pct, usd, usdCents } from '../../../core/formatting/format';
import { AmortizationResponse } from '../../../core/models/amortization.models';
import { TPipe } from '../../../core/i18n/t.pipe';
import { t, tp } from '../../../core/i18n/i18n';

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
    const count = tp(p.points, '{p} point', '{p} points', { p: decimal(p.points, 3) });
    const opening = one
      ? t('{0} costs {1} at closing and lowers the payment {2} a month.', [count, usd(p.cost), usdCents(p.monthlySaving)])
      : t('{0} cost {1} at closing and lower the payment {2} a month.', [count, usd(p.cost), usdCents(p.monthlySaving)]);
    let rest: string;
    if (p.breakEvenPayment && p.breakEvenDate) {
      const args = [p.breakEvenPayment, monthOf(p.breakEvenDate), usd(p.netSaving)];
      rest = one
        ? t('The interest it saves covers that by payment {0} ({1}), and over the whole loan it saves {2} after its cost. Sell or refinance before then, and it costs more than it saved.', args)
        : t('The interest they save covers that by payment {0} ({1}), and over the whole loan they save {2} after their cost. Sell or refinance before then, and they cost more than they saved.', args);
    } else {
      rest = one
        ? t('At this price it never pays for itself: over the whole loan it saves {0} of interest, less than it costs.', [usd(p.interestSaved)])
        : t('At this price they never pay for themselves: over the whole loan they save {0} of interest, less than they cost.', [usd(p.interestSaved)]);
    }
    const verdict = `${opening} ${rest}`;

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
