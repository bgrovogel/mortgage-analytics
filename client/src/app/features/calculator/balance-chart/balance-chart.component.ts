import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { formatMonths } from '../../../core/formatting/duration';
import { monthOf, usd } from '../../../core/formatting/format';
import { AmortizationResponse } from '../../../core/models/amortization.models';
import { balanceFrames, balanceSeries, pathThrough, resample } from './balance-series';
import { PaymentLedgerComponent } from './payment-ledger.component';

/** The chart is drawn in a 1000 x 320 box and scaled to its width; curves are read at this many points. */
const WIDTH = 1000;
const HEIGHT = 320;
const POINTS = 120;

/**
 * What you owe, month by month: the balance with extra payments against the standard schedule drawn as a ghost, in
 * time frames, with a scrubber (a native range input, so the arrow keys work and a screen reader reads the numbers) whose
 * month the tooltip and the ledger beneath follow (UI blueprint, pillar 2). It sits straight on the page, no card.
 */
@Component({
  selector: 'app-balance-chart',
  imports: [PaymentLedgerComponent],
  templateUrl: './balance-chart.component.html',
  styleUrl: './balance-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BalanceChartComponent {
  /** The analysis whose two balance curves are plotted. */
  readonly result = input.required<AmortizationResponse>();

  protected readonly series = computed(() => balanceSeries(this.result()));
  private readonly term = computed(() => this.result().baseline.payments.length);

  /** The time frames that fit the loan; "to payoff" only when extra payments move the payoff. */
  protected readonly frames = computed(() =>
    balanceFrames(this.term(), this.series().hasExtra ? this.series().payoffMonth : this.term()));

  /** The frame the reader chose; the full term until they do. */
  private readonly chosenFrame = signal<string>('all');
  protected readonly frame = computed(() => (this.frames().some((f) => f.value === this.chosenFrame()) ? this.chosenFrame() : 'all'));

  /** How many months the chart spans. */
  protected readonly domain = computed(() => this.frames().find((f) => f.value === this.frame())?.months ?? this.term());

  /** The month the scrubber is on, kept within the frame; a third of the way along until the reader moves it. */
  private readonly chosenMonth = signal<number | null>(null);
  protected readonly month = computed(() => {
    const domain = this.domain();
    const wanted = this.chosenMonth() ?? Math.max(1, Math.round(domain / 3));
    return Math.min(Math.max(1, wanted), domain);
  });

  /** The balance both ways at the month. */
  protected readonly at = computed(() => {
    const { extra, scheduled, interest } = this.series();
    const m = this.month();
    const payment = this.result().baseline.payments[m - 1];
    return {
      extra: extra[m], scheduled: scheduled[m], gap: scheduled[m] - extra[m], interest: interest[m],
      date: payment ? monthOf(payment.dueDate) : '', month: m,
    };
  });

  /** The paths, scaled to the largest balance. */
  protected readonly paths = computed(() => {
    const s = this.series();
    const max = s.scheduled[0];
    const extra = pathThrough(resample(s.extra, this.domain(), POINTS), WIDTH, HEIGHT, max);
    return {
      extra,
      scheduled: pathThrough(resample(s.scheduled, this.domain(), POINTS), WIDTH, HEIGHT, max),
      area: `${extra}L${WIDTH} ${HEIGHT}L0 ${HEIGHT}Z`,
    };
  });

  /** Where the cursor stands on the chart, in percent, and the balance dots with it. */
  protected readonly cursor = computed(() => {
    const max = this.series().scheduled[0] || 1;
    const left = (this.month() / this.domain()) * 100;
    return {
      x: (left * WIDTH) / 100,
      left,
      extraTop: (1 - this.at().extra / max) * 100,
      scheduledTop: (1 - this.at().scheduled / max) * 100,
      // The tooltip sits to the side of the cursor with more room.
      onRight: left > 64,
    };
  });

  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;

  /** The first, middle and last dates of the frame, under the chart. */
  protected readonly axis = computed(() => {
    const payments = this.result().baseline.payments;
    const at = (month: number) => monthOf(payments[Math.max(0, Math.min(payments.length - 1, month - 1))]?.dueDate ?? '');
    const domain = this.domain();
    return { start: at(1), mid: at(Math.round(domain / 2)), end: at(domain) };
  });

  /** What the chart says, in a sentence: when the loan clears, and how much sooner than scheduled. */
  protected readonly summary = computed(() => {
    const r = this.result();
    const payments = r.accelerated.payments;
    const clears = monthOf(payments[payments.length - 1]?.dueDate ?? r.baseline.payoffDate);
    return this.series().hasExtra && r.savings.paymentsSaved > 0
      ? `Paying extra clears the loan in ${clears}, ${formatMonths(r.savings.paymentsSaved)} sooner than scheduled.`
      : `The loan runs until ${clears}.`;
  });

  /** What a screen reader says for the scrubber's position: the date and what is owed, never a bare number. */
  protected readonly valueText = computed(() => {
    const a = this.at();
    return this.series().hasExtra
      ? `Payment ${a.month}, ${a.date}: you owe ${usd(a.extra)} with extra, ${usd(a.scheduled)} on schedule`
      : `Payment ${a.month}, ${a.date}: you owe ${usd(a.extra)}`;
  });

  protected readonly usd = usd;

  protected pick(frame: string): void {
    this.chosenFrame.set(frame);
  }

  protected scrub(event: Event): void {
    this.chosenMonth.set(Number((event.target as HTMLInputElement).value));
  }

  /** Page Up and Page Down move a year, the arrow keys a month (the input does that itself). */
  protected key(event: KeyboardEvent): void {
    const by = event.key === 'PageUp' ? 12 : event.key === 'PageDown' ? -12 : 0;
    if (by === 0) return;
    event.preventDefault();
    this.chosenMonth.set(this.month() + by);
  }
}
