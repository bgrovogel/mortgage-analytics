import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { pct, usd, usdCents } from '../../../core/formatting/format';
import { RateWhatIfLoan, whatIf } from './rate-what-if';

/** How far the slider reaches either way, and how finely: eighths of a point, as lenders quote rates. */
const REACH = 1.5;
const STEP = 0.125;

/**
 * A short pulse as the slider crosses a step, on a phone that can (never on a desktop, and not for anyone who has asked
 * for less motion). It is felt, not announced: nothing depends on it.
 */
export function detent(): void {
  try {
    const touch = window.matchMedia('(pointer: coarse)').matches;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (touch && !calm && typeof navigator.vibrate === 'function') navigator.vibrate(8);
  } catch {
    // No vibration here; the slider still works.
  }
}

const signed = (value: number, format: (amount: number) => string) => `${value < 0 ? '−' : '+'}${format(Math.abs(value))}`;

/**
 * What a different rate would do to the payment and to the interest over the loan: a slider from a point and a half
 * below the rate to a point and a half above it, answering "is it worth shopping around, or waiting?". It prices
 * principal and interest alone, so it is left out for a loan whose rate changes along the way.
 */
@Component({
  selector: 'app-rate-what-if',
  template: `
    @if (loan(); as l) {
      @let w = scenario();
      <section class="panel" [class.bare]="bare()" data-testid="rate-what-if">
        <h3>What if the rate were different?</h3>
        <div class="control">
          <label for="what-if-slider">Rate</label>
          <output for="what-if-slider" class="rate" data-testid="what-if-rate">{{ pct(w.rate, 3) }}</output>
          <input id="what-if-slider" type="range" data-testid="what-if-slider" [min]="-reach" [max]="reach" [step]="step"
                 [value]="delta()" [attr.aria-valuetext]="pct(w.rate, 3)" (input)="move($event)" />
          @if (delta() !== 0) {
            <button type="button" class="link" data-testid="what-if-reset" (click)="delta.set(0)">Back to {{ pct(l.rate, 3) }}</button>
          }
        </div>
        <dl class="figures">
          <div>
            <dt>Principal and interest</dt>
            <dd data-testid="what-if-payment">{{ usdCents(w.payment) }}/mo</dd>
            <dd class="change" data-testid="what-if-payment-change">{{ paymentChange() }}</dd>
          </div>
          <div>
            <dt>Interest over the loan</dt>
            <dd data-testid="what-if-interest">{{ usd(w.interest) }}</dd>
            <dd class="change" data-testid="what-if-interest-change">{{ interestChange() }}</dd>
          </div>
        </dl>
        <p class="note" data-testid="what-if-note">
          Each quarter of a point on this loan is about {{ usdCents(quarterPoint()) }} a month. Principal and interest only, paid on schedule.
        </p>
      </section>
    }
  `,
  styleUrl: './rate-what-if.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RateWhatIfComponent {
  /** The loan to price at other rates; null where one rate does not describe it, which leaves this out. */
  readonly loan = input.required<RateWhatIfLoan | null>();

  /** True inside a panel that is already a card (a tab): no card of its own, so it is not a card in a card. */
  readonly bare = input(false);

  /** Percentage points added to (or taken off) the loan's rate. */
  protected readonly delta = signal(0);

  protected readonly scenario = computed(() => whatIf(this.loan()!, this.delta()));
  protected readonly quarterPoint = computed(() => whatIf(this.loan()!, 0.25).paymentChange);

  protected readonly paymentChange = computed(() => {
    const change = this.scenario().paymentChange;
    return change === 0 ? 'As it is now' : `${signed(change, usdCents)} a month`;
  });

  protected readonly interestChange = computed(() => {
    const change = this.scenario().interestChange;
    return change === 0 ? 'As it is now' : `${signed(change, usd)} over the loan`;
  });

  protected readonly reach = REACH;
  protected readonly step = STEP;
  protected readonly pct = pct;
  protected readonly usd = usd;
  protected readonly usdCents = usdCents;

  protected move(event: Event): void {
    this.delta.set(Number((event.target as HTMLInputElement).value));
    detent();
  }
}
