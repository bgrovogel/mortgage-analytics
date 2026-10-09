import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import {
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartConfiguration,
} from 'chart.js';
import { AmortizationResponse } from '../../../core/models/amortization.models';

// Register only what this chart uses, so the rest of Chart.js is tree-shaken out.
Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler);

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const compactCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const monthYear = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/**
 * Remaining balance over time: standard payoff against accelerated payoff.
 * Colors are read from CSS custom properties, so light and dark mode stay in one place (styles.scss).
 */
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
  private chart?: Chart<'line'>;

  constructor() {
    const host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;

    afterRenderEffect(() => this.render(host));

    // Re-read the color tokens when the OS theme flips.
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onThemeChange = () => this.render(host);
    media.addEventListener('change', onThemeChange);

    inject(DestroyRef).onDestroy(() => {
      media.removeEventListener('change', onThemeChange);
      this.chart?.destroy();
    });
  }

  /** Rebuilds the chart from the current result, reading colors from the host's CSS tokens. */
  private render(host: HTMLElement): void {
    const config = this.buildConfig(this.result(), getComputedStyle(host));
    this.chart?.destroy();
    this.chart = new Chart(this.canvas().nativeElement, config);
  }

  /** Builds the Chart.js configuration: two 2px lines, one y-axis, a crosshair tooltip and a legend. */
  private buildConfig(result: AmortizationResponse, css: CSSStyleDeclaration): ChartConfiguration<'line'> {
    const token = (name: string) => css.getPropertyValue(name).trim();
    const baselineColor = token('--series-1');
    const acceleratedColor = token('--series-2');
    const grid = token('--grid');
    const muted = token('--text-muted');
    const labels = result.baseline.payments.map((p) => monthYear.format(new Date(p.dueDate)));

    const line = (label: string, color: string, data: number[]) => ({
      label,
      data,
      borderColor: color,
      backgroundColor: color,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBorderWidth: 2,
      pointHoverBorderColor: token('--surface-1'),
      tension: 0,
    });

    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          line('Standard payoff', baselineColor, result.baseline.payments.map((p) => p.remainingBalance)),
          line('With extra payments', acceleratedColor, result.accelerated.payments.map((p) => p.remainingBalance)),
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            align: 'start',
            labels: { color: token('--text-secondary'), usePointStyle: true, pointStyle: 'line', boxWidth: 24 },
          },
          tooltip: {
            callbacks: {
              title: (items) => `Payment ${items[0].dataIndex + 1} · ${items[0].label}`,
              label: (item) => ` ${item.dataset.label}: ${currency.format(item.parsed.y ?? 0)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { color: grid },
            ticks: { color: muted, maxTicksLimit: 8, maxRotation: 0, autoSkipPadding: 24 },
          },
          y: {
            beginAtZero: true,
            grid: { color: grid },
            border: { display: false },
            ticks: { color: muted, callback: (value) => compactCurrency.format(Number(value)) },
          },
        },
      },
    };
  }
}
