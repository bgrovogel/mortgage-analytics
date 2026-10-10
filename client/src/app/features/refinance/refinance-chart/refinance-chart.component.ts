import { ChangeDetectionStrategy, Component, ElementRef, input, viewChild } from '@angular/core';
import { hostChart } from '../../../core/charts/chart-host';
import { LineSeries, buildLineChart } from '../../../core/charts/line-chart';
import { LoanPayment, RefinanceResponse } from '../../../core/models/refinance.models';
import { monthOf } from '../../../core/formatting/format';


/** Each option's balance after every payment, padded with $0 once it is paid off. */
const balances = (payments: LoanPayment[], length: number) =>
  Array.from({ length }, (_, i) => payments[i]?.remainingBalance ?? 0);

/** Remaining balance over time for the current loan, the refinance, and the refinance at today's payment. */
@Component({
  selector: 'app-refinance-chart',
  template: `
    <figure>
      <figcaption id="refi-chart-title">What you owe over time</figcaption>
      <div class="canvas-wrap">
        <canvas #canvas role="img" aria-labelledby="refi-chart-title" data-testid="refi-chart"></canvas>
      </div>
    </figure>
  `,
  styles: `
    figure { margin: 0; }
    figcaption { font-weight: 600; margin-bottom: 0.75rem; color: var(--text-primary); }
    .canvas-wrap { position: relative; height: 300px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RefinanceChartComponent {
  /** The comparison whose balances are plotted. */
  readonly result = input.required<RefinanceResponse>();

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    hostChart(
      () => this.canvas().nativeElement,
      (host) => {
        const { current, refinanced, keepingCurrentPayment } = this.result();
        const longest = [current, refinanced, keepingCurrentPayment ?? current].reduce((a, b) => (b.payments.length > a.payments.length ? b : a));
        const length = longest.payments.length;
        const series: LineSeries[] = [
          { label: 'Current loan', color: '--series-1', data: balances(current.payments, length) },
          { label: 'Refinance', color: '--series-2', data: balances(refinanced.payments, length) },
        ];
        if (keepingCurrentPayment) {
          series.push({ label: 'Refinance, keep payment', color: '--series-3', data: balances(keepingCurrentPayment.payments, length), dashed: true });
        }
        return buildLineChart(
          {
            labels: longest.payments.map((p) => monthOf(p.dueDate)),
            series,
            title: (index, label) => `Payment ${index + 1} · ${label}`,
            tickEvery: 12,
          },
          host,
        );
      },
    );
  }
}
