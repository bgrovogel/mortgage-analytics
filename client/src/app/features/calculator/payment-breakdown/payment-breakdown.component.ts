import { CurrencyPipe, PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Schedule } from '../../../core/models/amortization.models';

/** One slice of the monthly payment. */
interface Slice {
  label: string;
  amount: number;
  share: number;
  /** CSS custom property holding this category's color. Fixed per category, so colors never shift between results. */
  color: string;
}

/**
 * Where the first month's payment goes: principal and interest, then each housing cost.
 * Shown as a single stacked bar (part-to-whole) with a labelled legend, so no slice relies on color alone.
 */
@Component({
  selector: 'app-payment-breakdown',
  imports: [CurrencyPipe, PercentPipe],
  template: `
    <h2 id="breakdown-title">Monthly payment breakdown</h2>
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
          <th scope="row">Total</th>
          <td data-testid="breakdown-total">{{ schedule().totalMonthlyPayment | currency }}</td>
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

  /** Non-zero slices in a fixed category order. */
  readonly slices = computed<Slice[]>(() => {
    const s = this.schedule();
    const c = s.monthlyHousingCosts;
    const all: Omit<Slice, 'share'>[] = [
      { label: 'Principal & interest', amount: s.monthlyPayment, color: '--series-1' },
      { label: 'Property tax', amount: c.propertyTax, color: '--series-2' },
      { label: 'MUD tax', amount: c.mudTax, color: '--series-3' },
      { label: 'PID assessment', amount: c.pidAssessment, color: '--series-4' },
      { label: 'Home insurance', amount: c.homeownersInsurance, color: '--series-5' },
      { label: 'PMI', amount: c.mortgageInsurance, color: '--series-6' },
      { label: 'HOA dues', amount: c.hoaDues, color: '--series-7' },
    ];
    const total = s.totalMonthlyPayment || 1;
    return all.filter((x) => x.amount > 0).map((x) => ({ ...x, share: x.amount / total }));
  });

  /** A text alternative for the bar, read by screen readers. */
  readonly ariaLabel = computed(() =>
    this.slices()
      .map((s) => `${s.label} ${Math.round(s.share * 100)}%`)
      .join(', '),
  );
}
