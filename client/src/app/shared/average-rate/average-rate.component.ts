import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { decimal } from '../../core/formatting/format';
import { AverageRatesService } from '../../core/services/average-rates.service';
import { TPipe } from '../../core/i18n/t.pipe';

/**
 * This week's average mortgage rate, under a rate box, for someone with no quote yet: the 15-year average for a 15-year
 * loan, the 30-year for any other, with who publishes it and for which week, and a button to start the rate from it. It
 * is a starting point, not an offer: a lender's rate depends on the buyer. Shows nothing when there are no rates to show.
 */
@Component({
  selector: 'app-average-rate',
  imports: [DatePipe, TPipe],
  template: `
    @if (average(); as a) {
      <p class="average" data-testid="average-rate">
        {{ 'This week’s average {0}-year fixed rate: {1}% ({2}, {3}).' | t: [a.years, decimal(a.rate), a.source, (a.asOf | date: ('MMM d' | t))] }}
        @if (a.rate !== current()) {
          <button type="button" class="link-button" (click)="use.emit(a.rate)" data-testid="use-average-rate">{{ 'Use {0}%' | t: [decimal(a.rate)] }}</button>
        } @else {
          <span data-testid="using-average-rate">{{ 'You are using it.' | t }}</span>
        }
      </p>
    }
  `,
  styles: `
    .average {
      margin: 0;
      font-size: 0.82rem;
      line-height: 1.45;
      color: var(--text-muted);
    }

    .link-button {
      font: inherit;
      padding: 0;
      border: 0;
      background: none;
      color: var(--accent-text);
      text-decoration: underline;
      cursor: pointer;
      min-height: 24px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AverageRateComponent {
  private readonly service = inject(AverageRatesService);

  /** The loan's term in years: 15 gets the 15-year average, anything else the 30-year. */
  readonly termYears = input<number | null | undefined>(30);

  /** The rate now in the box, so the button is not offered for what it already says. */
  readonly current = input<number | null | undefined>(null);

  /** The visitor chose to start from the average. */
  readonly use = output<number>();

  protected readonly decimal = decimal;

  /** The average that fits the term, with the week and who publishes it; null until there is one. */
  protected readonly average = computed(() => {
    const rates = this.service.rates();
    if (!rates) return null;
    const fifteen = this.termYears() === 15;
    return {
      years: fifteen ? 15 : 30,
      rate: fifteen ? rates.fifteenYearFixed : rates.thirtyYearFixed,
      asOf: rates.asOf,
      source: rates.source.replace(' Primary Mortgage Market Survey', ''),
    };
  });

  constructor() {
    this.service.load();
  }
}
