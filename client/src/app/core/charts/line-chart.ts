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
import { compactUsd, usd } from '../formatting/format';

// Register only what the line charts use, so the rest of Chart.js is tree-shaken out.
Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler);

/** One line on a chart. */
export interface LineSeries {
  label: string;
  /** CSS custom property holding the line's color, e.g. `--series-1`. */
  color: string;
  data: number[];
  /** Draws a dashed line, so a series stays visible when it overlaps another. */
  dashed?: boolean;
  /** Draws a dotted line: a third style, for when three series can overlap. */
  dotted?: boolean;
  /** A custom dash pattern (dash and gap lengths), for a fourth style. Overrides dashed and dotted. */
  dash?: number[];
  /** Shades the area between this series and the one before it (e.g. the gap two payoffs open up). */
  fillToPrevious?: boolean;
}

/** Everything that differs between the app's line charts. */
export interface LineChartSpec {
  labels: string[];
  series: LineSeries[];
  /** Tooltip title for the hovered index, e.g. "Payment 12 · Dec 2026". */
  title: (index: number, label: string) => string;
  /** Optional tooltip footer, e.g. a total across all series. */
  footer?: (index: number) => string;
  /** Stacks the series as filled areas, so the top edge is their total (a part-to-whole over time). */
  stacked?: boolean;
  /** Label the x-axis in steps of this many points, e.g. 12 for whole years of monthly data. Defaults to 1. */
  tickEvery?: number;
}

/**
 * Builds a Chart.js line configuration in the app's visual language: 2px lines with no markers,
 * a single y-axis in compact currency, a recessive grid, a legend, and a crosshair tooltip.
 * Colors are read from CSS tokens on `host`, so light and dark mode are handled in styles.scss.
 */
export function buildLineChart(spec: LineChartSpec, host: HTMLElement): ChartConfiguration<'line'> {
  const css = getComputedStyle(host);
  const token = (name: string) => css.getPropertyValue(name).trim();
  // Areas are tints of the line colour. Stacked bands never overlap, so they can be stronger.
  const tint = (name: string) => withAlpha(token(name), spec.stacked ? 0.55 : 0.28);
  const grid = token('--grid');
  const muted = token('--text-muted');
  // The page's typeface (Chart.js would otherwise draw in Helvetica or Arial), on every label it draws.
  const font = { family: token('--font-sans') };
  // As many x labels as fit the chart's width (so "Nov 2026" labels never run together on a phone), up to
  // MAX_X_TICKS. Chart.js calls the tick callback again whenever the chart resizes, with the new width.
  const labelWidth = Math.max(0, ...spec.labels.map((l) => l.length)) * LABEL_CHAR_PX + LABEL_GAP_PX;
  const ticksByCount = new Map<number, Set<number>>();
  const shownTicks = (width: number | undefined) => {
    const count = width ? Math.min(MAX_X_TICKS, Math.max(2, Math.floor(width / labelWidth))) : MAX_X_TICKS;
    if (!ticksByCount.has(count)) ticksByCount.set(count, new Set(tickIndices(spec.labels.length, count, spec.tickEvery)));
    return ticksByCount.get(count)!;
  };

  return {
    type: 'line',
    data: {
      labels: spec.labels,
      datasets: spec.series.map((s, i) => ({
        label: s.label,
        data: s.data,
        borderColor: token(s.color),
        backgroundColor: spec.stacked || s.fillToPrevious ? tint(s.color) : token(s.color),
        // A stacked band fills down to the band below it; the first one down to zero.
        fill: spec.stacked ? (i === 0 ? 'origin' : '-1') : s.fillToPrevious ? '-1' : false,
        // Chart.js draws the first series on top. Reverse that, so a later (often dashed) series that
        // overlaps an earlier one stays visible. Stacked areas keep the default: order changes stacking.
        order: spec.stacked ? undefined : -i,
        borderWidth: 2,
        borderDash: s.dash ?? (s.dashed ? [6, 4] : s.dotted ? [2, 4] : []),
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
          labels: {
            color: token('--text-secondary'),
            font,
            usePointStyle: true,
            pointStyle: 'line',
            boxWidth: 24,
            // The legend follows the drawing order unless told otherwise; keep the listed order.
            sort: (a, b) => a.datasetIndex! - b.datasetIndex!,
          },
        },
        tooltip: {
          titleFont: font,
          bodyFont: font,
          footerFont: font,
          itemSort: (a, b) => a.datasetIndex - b.datasetIndex,
          callbacks: {
            title: (items) => spec.title(items[0].dataIndex, items[0].label),
            label: (item) => ` ${item.dataset.label}: ${usd(item.parsed.y ?? 0)}`,
            footer: spec.footer ? (items) => spec.footer!(items[0].dataIndex) : undefined,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: grid },
          // Ticks are chosen here rather than by Chart.js's auto-skip, which can drop the last label.
          ticks: {
            color: muted,
            font,
            maxRotation: 0,
            autoSkip: false,
            callback(this: { width?: number } | undefined, _value: unknown, index: number) {
              return shownTicks(this?.width).has(index) ? spec.labels[index] : null;
            },
          },
        },
        y: {
          stacked: spec.stacked ?? false,
          beginAtZero: true,
          grid: { color: grid },
          border: { display: false },
          ticks: { color: muted, font, callback: (value) => compactUsd(Number(value)) },
        },
      },
    },
  };
}

const MAX_X_TICKS = 8;

/** About how wide one character of an axis label is, in pixels, and the space kept between labels. */
const LABEL_CHAR_PX = 6;
const LABEL_GAP_PX = 14;

/**
 * Which points get an x-axis label: at most `max`, evenly spaced in whole multiples of `every`,
 * always including the first and the last. A regular label that would crowd the last one is dropped.
 */
export function tickIndices(count: number, max: number, every = 1): number[] {
  if (count === 0) return [];
  const last = count - 1;
  const step = Math.max(every, Math.ceil(last / (max - 1) / every) * every);
  const ticks: number[] = [];
  for (let i = 0; i < last; i += step) ticks.push(i);
  if (ticks.length > 1 && last - ticks[ticks.length - 1] < step / 2) ticks.pop();
  ticks.push(last);
  return ticks;
}

/**
 * Turns a "#rrggbb" token into rgba() with the given opacity. Canvas colour parsing is older than CSS
 * colour functions, so plain rgba() is the safe form. Anything else is returned unchanged.
 */
export function withAlpha(color: string, alpha: number): string {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  return hex
    ? `rgba(${parseInt(hex[1], 16)}, ${parseInt(hex[2], 16)}, ${parseInt(hex[3], 16)}, ${alpha})`
    : color;
}
