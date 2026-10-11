import { ChangeDetectionStrategy, Component, ElementRef, input, viewChild } from '@angular/core';
import { hostChart } from '../../../core/charts/chart-host';
import { buildLineChart } from '../../../core/charts/line-chart';
import { AmortizationResponse } from '../../../core/models/amortization.models';
import { monthOf } from '../../../core/formatting/format';

/** Remaining loan balance over time: standard payoff against accelerated payoff. */
@Component({
  selector: 'app-balance-chart',
  template: `
    <figure>
      <figcaption id="balance-chart-title">Remaining balance over time</figcaption>
      <div class="canvas-wrap">
        <canvas #canvas role="img" aria-labelledby="balance-chart-title" data-testid="balance-chart"></canvas>
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
export class BalanceChartComponent {
  /** The analysis whose two balance curves are plotted. */
  readonly result = input.required<AmortizationResponse>();

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    hostChart(
      () => this.canvas().nativeElement,
      (host) => {
        const { baseline, accelerated } = this.result();
        return buildLineChart(
          {
            labels: baseline.payments.map((p) => monthOf(p.dueDate)),
            series: [
              { label: 'Standard payoff', color: '--series-1', data: baseline.payments.map((p) => p.remainingBalance) },
              // Shading down to the standard payoff makes the time and interest saved visible as an area.
              // Once paid off the balance stays at $0, so the line and the shading run to the standard payoff.
              {
                label: 'With extra payments',
                color: '--series-2',
                data: baseline.payments.map((_, i) => accelerated.payments[i]?.remainingBalance ?? 0),
                fillToPrevious: true,
              },
            ],
            title: (index, label) => `Payment ${index + 1} · ${label}`,
            tickEvery: 12, // label whole years
          },
          host,
        );
      },
    );
  }
}
