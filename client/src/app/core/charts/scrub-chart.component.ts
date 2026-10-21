import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { compactUsd, usd } from '../formatting/format';

/** One line on a chart. */
export interface ScrubSeries {
  label: string;
  /** CSS custom property holding the line's color, e.g. `--series-1`. */
  color: string;
  data: number[];
  /** Draws a dashed line, so a series stays visible when it runs along another. */
  dashed?: boolean;
  /** Draws a dotted line: a third style. */
  dotted?: boolean;
  /** A custom dash pattern (dash and gap lengths), for a fourth style. Overrides dashed and dotted. */
  dash?: number[];
  /** Shades the area between this series and the one before it. */
  fillToPrevious?: boolean;
}

/** What differs between the app's charts of a few lines over time. */
export interface ScrubChartSpec {
  labels: string[];
  series: ScrubSeries[];
  /** The heading of a point, e.g. "Year 5" or "Payment 12 · Dec 2026". */
  title: (index: number, label: string) => string;
  /** An optional line under a point's figures, e.g. a total. */
  footer?: (index: number) => string;
  /** How many points Page Up and Page Down move; the arrow keys move one. */
  tickEvery?: number;
  /** Stacks the series as areas, so the top edge is their total (a part-to-whole over time). */
  stacked?: boolean;
}

const WIDTH = 1000;
const HEIGHT = 320;

let nextId = 0;

/**
 * A few lines over time, drawn as SVG the blueprint's way (UI blueprint, pillars 2 and 4): straight on the page, a
 * scrubber that is a native range input (arrow keys move a point, Page Up and Page Down a step, and a screen reader
 * reads the date and every figure), a tooltip for the point, and the series in a key.
 */
@Component({
  selector: 'app-scrub-chart',
  template: `
    @let a = at();
    @let c = cursor();
    <figure>
      <div class="head">
        <figcaption [id]="titleId" class="title">{{ title() }}</figcaption>
        <button type="button" class="as-table" data-testid="chart-as-table" [attr.aria-pressed]="asTable()" (click)="asTable.set(!asTable())">
          {{ asTable() ? 'View as chart' : 'View as table' }}
        </button>
      </div>
      <ul class="key" aria-hidden="true">
        @for (s of spec().series; track s.label) {
          <li><span class="swatch" [class.dashed]="s.dashed || !!s.dash" [class.dotted]="s.dotted" [style.border-color]="'var(' + s.color + ')'"></span>{{ s.label }}</li>
        }
      </ul>
      @if (asTable()) {
        <div class="table-wrap" tabindex="0" role="region" [attr.aria-labelledby]="titleId">
          <table>
            <caption class="visually-hidden">{{ title() }}</caption>
            <thead>
              <tr>
                <th scope="col">When</th>
                @for (s of spec().series; track s.label) {
                  <th scope="col">{{ s.label }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (label of spec().labels; track $index; let row = $index) {
                <tr>
                  <th scope="row">{{ label }}</th>
                  @for (s of spec().series; track s.label) {
                    <td>{{ usd(s.data[row] ?? 0) }}</td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
      <div class="plot">
        <div class="canvas" (pointermove)="hover($event)" (pointerdown)="press($event)">
        <svg role="img" [attr.data-testid]="testId()" [attr.aria-labelledby]="titleId" [attr.viewBox]="'0 0 ' + width + ' ' + height" preserveAspectRatio="none">
          <g class="grid">
            @for (y of [0, 80, 160, 240]; track y) {
              <line x1="0" [attr.y1]="y" [attr.x2]="width" [attr.y2]="y" />
            }
          </g>
          <line class="floor" x1="0" [attr.y1]="height" [attr.x2]="width" [attr.y2]="height" />
          @if (zeroY(); as y) {
            <line class="zero" x1="0" [attr.y1]="y" [attr.x2]="width" [attr.y2]="y" />
          }
          @for (s of lines(); track s.label) {
            @if (s.area) {
              <path class="area" [attr.d]="s.area" [style.fill]="'var(' + s.color + ')'" />
            }
          }
          @for (s of lines(); track s.label) {
            <path class="line" [class.dashed]="s.dashed" [class.dotted]="s.dotted" [attr.d]="s.path" [style.stroke]="'var(' + s.color + ')'" [style.stroke-dasharray]="s.dash ? s.dash.join(' ') : null" />
          }
          <line class="cursor" [attr.x1]="c.x" y1="0" [attr.x2]="c.x" [attr.y2]="height" />
        </svg>
        @for (d of c.dots; track $index) {
          <span class="dot" aria-hidden="true" [style.left.%]="c.left" [style.top]="'calc(' + d.top + ' * var(--plot-h) / 100)'" [style.background]="'var(' + d.color + ')'"></span>
        }
        <div class="tip" aria-hidden="true" [class.on-right]="c.onRight" [style.left]="c.onRight ? 'auto' : 'calc(' + c.left + '% + 16px)'"
             [style.right]="c.onRight ? 'calc(' + (100 - c.left) + '% + 16px)' : 'auto'">
          <div class="when" data-testid="scrub-title">{{ a.title }}</div>
          @for (row of a.rows; track row.label; let i = $index) {
            <div class="row" [attr.data-testid]="'scrub-row-' + i">
              <span><span class="swatch small" [style.background]="'var(' + row.color + ')'"></span>{{ row.label }}</span>
              &ngsp;<span class="figure">{{ row.value }}</span>
            </div>
          }
          @if (a.footer) {
            <div class="row foot" data-testid="scrub-footer">{{ a.footer }}</div>
          }
        </div>
        </div>
        <div class="y" aria-hidden="true">
          @for (label of yLabels(); track label.text) {
            <span [style.top.%]="label.top">{{ label.text }}</span>
          }
        </div>
      </div>
      <div class="axis" aria-hidden="true">
        @for (label of xLabels(); track $index) {
          <span>{{ label }}</span>
        }
      </div>
      <div class="scrub">
        <label [for]="inputId">Scrub through the chart</label>
        <input [id]="inputId" data-testid="scrub-input" type="range" min="0" [max]="last()" step="1" [value]="index()"
               [attr.aria-valuetext]="a.valueText" (input)="scrub($event)" (keydown)="key($event)" />
      </div>
      }
    </figure>
  `,
  styleUrl: './scrub-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScrubChartComponent {
  /** The chart's caption: what it shows, and its accessible name. */
  readonly title = input.required<string>();

  /** What is drawn. */
  readonly spec = input.required<ScrubChartSpec>();

  /** The test id of the picture itself. */
  readonly testId = input('scrub-chart');

  /** The point the reader scrubbed to, as it is chosen (not on first draw), for a page that follows it. */
  readonly picked = output<number>();

  protected readonly titleId = `scrub-title-${nextId}`;
  protected readonly inputId = `scrub-input-${nextId++}`;
  protected readonly usd = usd;
  protected readonly width = WIDTH;

  /** Whether the figures are shown as a table instead of the drawing. */
  protected readonly asTable = signal(false);
  protected readonly height = HEIGHT;

  /** The index of the last point. */
  protected readonly last = computed(() => Math.max(0, this.spec().labels.length - 1));

  /** The point the scrubber is on; the middle until the reader moves it. */
  private readonly chosen = signal<number | null>(null);
  protected readonly index = computed(() => Math.min(this.last(), Math.max(0, this.chosen() ?? Math.floor(this.last() / 2))));

  /** The vertical span of the data, always including zero, with a little room above. */
  private readonly range = computed(() => {
    const all = this.stack().length > 0 ? this.stack()[this.stack().length - 1] : this.spec().series.flatMap((s) => s.data);
    const lo = Math.min(0, ...all);
    const hi = Math.max(0, ...all);
    const span = hi - lo || 1;
    return { lo, hi, top: hi + span * 0.04, span: span * 1.04 };
  });

  /** For stacked areas: each series' running total, so the top edge of the last is the total. */
  private readonly stack = computed(() => {
    const spec = this.spec();
    if (!spec.stacked) return [];
    return spec.series.reduce<number[][]>((rows, s, i) => {
      const below = rows[i - 1] ?? s.data.map(() => 0);
      rows.push(s.data.map((v, k) => below[k] + v));
      return rows;
    }, []);
  });

  private readonly x = (i: number) => (this.last() === 0 ? 0 : (i / this.last()) * WIDTH);
  private readonly y = (v: number) => HEIGHT - ((v - this.range().lo) / this.range().span) * HEIGHT;

  /** Where zero stands, when the data goes below it (otherwise it is the floor). */
  protected readonly zeroY = computed(() => (this.range().lo < 0 ? Math.round(this.y(0) * 10) / 10 : null));

  /** Each series as a path, and the area down to the series before it when asked for. */
  protected readonly lines = computed(() => {
    const series = this.spec().series;
    const points = (data: number[]) => data.map((v, i) => `${i === 0 ? 'M' : 'L'}${Math.round(this.x(i) * 10) / 10} ${Math.round(this.y(v) * 10) / 10}`).join('');
    const back = (data: number[]) => [...data].map((v, i) => `L${Math.round(this.x(i) * 10) / 10} ${Math.round(this.y(v) * 10) / 10}`).reverse().join('');
    const stack = this.stack();
    return series.map((s, i) => {
      if (stack.length > 0) {
        const zeros = s.data.map(() => 0);
        return { ...s, path: points(stack[i]), area: `${points(stack[i])}${back(stack[i - 1] ?? zeros)}Z` };
      }
      return { ...s, path: points(s.data), area: s.fillToPrevious && i > 0 ? `${points(s.data)}${back(series[i - 1].data)}Z` : '' };
    });
  });

  /** What the point under the scrubber says: its heading, each series' figure, and the footer. */
  protected readonly at = computed(() => {
    const spec = this.spec();
    const i = this.index();
    // Nothing to read yet: no points, so no heading to ask for.
    if (spec.labels.length === 0) return { title: '', rows: [], footer: '', valueText: '' };
    const title = spec.title(i, spec.labels[i] ?? '');
    const rows = spec.series.map((s) => ({ label: s.label, color: s.color, value: usd(s.data[i] ?? 0) }));
    return {
      title,
      rows,
      footer: spec.footer?.(i) ?? '',
      valueText: `${title}: ${rows.map((r) => `${r.label} ${r.value}`).join(', ')}`,
    };
  });

  /** The cursor, the dots on each line, and which side the tooltip takes. */
  protected readonly cursor = computed(() => {
    const i = this.index();
    const left = this.last() === 0 ? 0 : (i / this.last()) * 100;
    return {
      x: this.x(i),
      left,
      onRight: left > 64,
      // On stacked areas each line is drawn at its running total, so that is where its dot goes.
      dots: this.spec().series.map((s, k) => ({ color: s.color, top: (this.y(this.stack()[k]?.[i] ?? s.data[i] ?? 0) / HEIGHT) * 100 })),
    };
  });

  /** The top, the bottom and (where it is inside) the zero of the vertical scale, in compact dollars. */
  protected readonly yLabels = computed(() => {
    const { lo, hi } = this.range();
    const labels = [{ text: compactUsd(hi), top: (this.y(hi) / HEIGHT) * 100 }];
    if (lo < 0 && hi > 0) labels.push({ text: '$0', top: (this.y(0) / HEIGHT) * 100 });
    labels.push({ text: compactUsd(lo), top: (this.y(lo) / HEIGHT) * 100 });
    return labels;
  });

  /** Five dates along the bottom: the start, the end and three between. */
  protected readonly xLabels = computed(() => {
    const labels = this.spec().labels;
    if (labels.length === 0) return [];
    const at = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * this.last()));
    return [...new Set(at)].map((i) => labels[i]);
  });

  protected scrub(event: Event): void {
    const index = Number((event.target as HTMLInputElement).value);
    this.chosen.set(index);
    this.picked.emit(index);
  }

  /** The point nearest the pointer, across the width of the drawing. */
  private nearest(event: MouseEvent): number {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    if (box.width === 0) return this.index();
    const fraction = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    return Math.round(fraction * this.last());
  }

  /** A mouse passing over the drawing reads each point; nothing is chosen until it is pressed. */
  protected hover(event: PointerEvent): void {
    if (event.pointerType === 'touch') return;
    this.chosen.set(this.nearest(event));
  }

  /** A press (a click or a touch) chooses the point under it. */
  protected press(event: PointerEvent): void {
    const index = this.nearest(event);
    this.chosen.set(index);
    this.picked.emit(index);
  }

  /** Page Up and Page Down move a step (a year, on monthly points); the arrow keys move one point themselves. */
  protected key(event: KeyboardEvent): void {
    const step = this.spec().tickEvery ?? 1;
    const by = event.key === 'PageUp' ? step : event.key === 'PageDown' ? -step : 0;
    if (by === 0) return;
    event.preventDefault();
    const index = Math.min(this.last(), Math.max(0, this.index() + by));
    this.chosen.set(index);
    this.picked.emit(index);
  }
}
