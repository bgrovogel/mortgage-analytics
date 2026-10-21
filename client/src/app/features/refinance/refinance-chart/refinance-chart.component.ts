import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ScrubChartComponent, ScrubChartSpec, ScrubSeries } from '../../../core/charts/scrub-chart.component';
import { LoanPayment, RefinanceResponse } from '../../../core/models/refinance.models';
import { monthOf } from '../../../core/formatting/format';
import { TPipe } from '../../../core/i18n/t.pipe';
import { t } from '../../../core/i18n/i18n';

/** Each option's balance after every payment, padded with $0 once it is paid off. */
const balances = (payments: LoanPayment[], length: number) =>
  Array.from({ length }, (_, i) => payments[i]?.remainingBalance ?? 0);

/** Remaining balance over time for the current loan, the refinance, and the refinance at today's payment. */
@Component({
  selector: 'app-refinance-chart',
  imports: [ScrubChartComponent, TPipe],
  template: `<app-scrub-chart [title]="'What you owe over time' | t" [spec]="spec()" testId="refi-chart" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RefinanceChartComponent {
  /** The comparison whose balances are plotted. */
  readonly result = input.required<RefinanceResponse>();

  /** What is drawn: each option's balance over the longest schedule. */
  readonly spec = computed<ScrubChartSpec>(() => {
    const { current, refinanced, keepingCurrentPayment } = this.result();
    const longest = [current, refinanced, keepingCurrentPayment ?? current].reduce((a, b) => (b.payments.length > a.payments.length ? b : a));
    const length = longest.payments.length;
    const series: ScrubSeries[] = [
      { label: t('Current loan'), color: '--series-1', data: balances(current.payments, length) },
      { label: t('Refinance'), color: '--series-2', data: balances(refinanced.payments, length) },
    ];
    if (keepingCurrentPayment) {
      series.push({ label: t('Refinance, keep payment'), color: '--series-3', data: balances(keepingCurrentPayment.payments, length), dashed: true });
    }
    return {
      labels: longest.payments.map((p) => monthOf(p.dueDate)),
      series,
      title: (index, label) => t('Payment {0} · {1}', [index + 1, label]),
      tickEvery: 12,
    };
  });
}
