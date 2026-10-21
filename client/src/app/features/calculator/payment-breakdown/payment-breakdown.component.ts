import { CurrencyPipe, PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LoanProgramType, Payment, Schedule } from '../../../core/models/amortization.models';
import { costCategoriesFor } from '../../../core/models/cost-categories';
import { TPipe } from '../../../core/i18n/t.pipe';
import { t } from '../../../core/i18n/i18n';

/** One slice of the monthly payment. */
interface Slice {
  label: string;
  amount: number;
  share: number;
  /** CSS custom property holding this category's color. Fixed per category, so colors never shift between results. */
  color: string;
}

/**
 * Where a month's payment goes (the first, or on a loan already being paid the next): principal and interest, then each
 * housing cost.
 * Shown as a single stacked bar (part-to-whole) with a labelled legend, so no slice relies on color alone.
 */
@Component({
  selector: 'app-payment-breakdown',
  imports: [CurrencyPipe, PercentPipe, TPipe],
  template: `
    <h2 id="breakdown-title" class="visually-hidden">{{ 'Monthly payment breakdown' | t }}</h2>
    <div class="bar" role="img" [attr.aria-label]="ariaLabel()">
      @for (slice of slices(); track slice.label) {
        <span [style.flex-grow]="slice.amount" [style.background]="'var(' + slice.color + ')'"></span>
      }
    </div>
    <table class="legend" aria-labelledby="breakdown-title" data-testid="payment-breakdown">
      <tbody>
        @for (slice of slices(); track slice.label) {
          <tr>
            <th scope="row"><i [style.background]="'var(' + slice.color + ')'"></i>{{ slice.label }}</th>
            <td>{{ slice.amount | currency }}</td>
            <td class="share">{{ slice.share | percent: '1.0-0' }}</td>
          </tr>
        }
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">{{ 'Total' | t }}</th>
          <td data-testid="breakdown-total">{{ total() | currency }}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
  `,
  styleUrl: './payment-breakdown.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentBreakdownComponent {
  /** The schedule whose first payment is broken down. */
  readonly schedule = input.required<Schedule>();

  /** The loan's program, which names its mortgage insurance; null for a conventional loan. */
  readonly program = input<{ type: LoanProgramType } | null>(null);

  /** The principal and interest actually paid at first, when it is not the schedule's (year 1 of a buydown). */
  readonly principalAndInterest = input<number | null>(null);

  /** On a loan already being paid, the payment due next, which is broken down instead of the first. */
  readonly current = input<Pick<Payment, 'scheduledPayment' | 'buydownSubsidy' | 'housingCosts' | 'costs'> | null>(null);

  /** The payment broken down: principal and interest as paid, and its housing costs by category. */
  private readonly payment = computed(() => {
    const next = this.current();
    const s = this.schedule();
    return next
      ? { loan: next.scheduledPayment - next.buydownSubsidy, costs: next.costs }
      : { loan: this.principalAndInterest() ?? s.monthlyPayment, costs: s.monthlyHousingCosts };
  });

  /** The month's payment: principal and interest as paid, plus housing costs. */
  readonly total = computed(() => this.payment().loan + this.payment().costs.total);

  /** Non-zero slices in a fixed category order. */
  readonly slices = computed<Slice[]>(() => {
    const { loan, costs: c } = this.payment();
    const all: Omit<Slice, 'share'>[] = [
      { label: t('Principal & interest'), amount: loan, color: '--series-1' },
      ...costCategoriesFor(this.program()).map((cat) => ({ label: cat.label, amount: c[cat.key], color: cat.color })),
    ];
    const total = this.total() || 1;
    return all.filter((x) => x.amount > 0).map((x) => ({ ...x, share: x.amount / total }));
  });

  /** A text alternative for the bar, read by screen readers. */
  readonly ariaLabel = computed(() =>
    this.slices()
      .map((s) => t('{0} {1}%', [s.label, Math.round(s.share * 100)]))
      .join(', '),
  );
}
