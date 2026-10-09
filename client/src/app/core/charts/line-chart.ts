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

// Register only what the line charts use, so the rest of Chart.js is tree-shaken out.
Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler);

export const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
export const compactCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** One line on a chart. */
export interface LineSeries {
  label: string;
  /** CSS custom property holding the line's color, e.g. `--series-1`. */
  color: string;
  data: number[];
  /** Draws a dashed line, so a series stays visible when it overlaps another. */
  dashed?: boolean;
}

/** Everything that differs between the app's line charts. */
export interface LineChartSpec {
  labels: string[];
  series: LineSeries[];
  /** Tooltip title for the hovered index, e.g. "Payment 12 · Dec 2026". */
  title: (index: number, label: string) => string;
  /** Optional tooltip footer, e.g. a total across all series. */
  footer?: (index: number) => string;
}

/**
 * Builds a Chart.js line configuration in the app's visual language: 2px lines with no markers,
 * a single y-axis in compact currency, a recessive grid, a legend, and a crosshair tooltip.
 * Colors are read from CSS tokens on `host`, so light and dark mode are handled in styles.scss.
 */
export function buildLineChart(spec: LineChartSpec, host: HTMLElement): ChartConfiguration<'line'> {
  const css = getComputedStyle(host);
  const token = (name: string) => css.getPropertyValue(name).trim();
  const grid = token('--grid');
  const muted = token('--text-muted');

  return {
    type: 'line',
    data: {
      labels: spec.labels,
      datasets: spec.series.map((s) => ({
        label: s.label,
        data: s.data,
        borderColor: token(s.color),
        backgroundColor: token(s.color),
        borderWidth: 2,
        borderDash: s.dashed ? [6, 4] : [],
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBorderWidth: 2,
        pointHoverBorderColor: token('--surface-1'),
        tension: 0,
      })),
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
            title: (items) => spec.title(items[0].dataIndex, items[0].label),
            label: (item) => ` ${item.dataset.label}: ${currency.format(item.parsed.y ?? 0)}`,
            footer: spec.footer ? (items) => spec.footer!(items[0].dataIndex) : undefined,
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
