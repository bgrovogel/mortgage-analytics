import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { ScrubChartComponent, ScrubChartSpec } from '../../../core/charts/scrub-chart.component';
import { decimal, usd } from '../../../core/formatting/format';
import { SaleOutcome, SaleYear } from '../../../core/models/amortization.models';
import { TPipe } from '../../../core/i18n/t.pipe';
import { t, tp } from '../../../core/i18n/i18n';

/** The years the table shows, of those the loan runs. */
const MILESTONES = [1, 2, 3, 5, 7, 10, 15, 20, 30];

/** The year the figures start on: the five it takes to see equity build, or the last year of a shorter loan. */
const STARTING_YEAR = 5;

/**
 * What selling the home would leave in hand: for a chosen year, the sale price less the loan, the costs and the tax on
 * the gain; the same by year in a chart, and the milestone years in a table, then what is assumed.
 */
@Component({
  selector: 'app-sale',
  imports: [ScrubChartComponent, TPipe],
  template: `
    <label class="picker">
      <span>{{ 'If you sell after' | t }}</span>
      <select [value]="chosen().year" (change)="year.set(+$any($event.target).value)" data-testid="sale-year">
        @for (y of sale().years; track y.year) {
          <option [value]="y.year" [selected]="y.year === chosen().year">{{ y.year }} {{ y.year === 1 ? ('year' | t) : ('years' | t) }}</option>
        }
      </select>
    </label>

    <div class="stats">
      <div class="stat" data-testid="sale-stat-net">
        <span>{{ chosen().netProceeds < 0 ? ('You would need to bring' | t) : ('You walk away with' | t) }}</span>
        <strong [class.short]="chosen().netProceeds < 0">{{ usd(abs(chosen().netProceeds)) }}</strong>
        <small>{{ chosen().netProceeds < 0 ? ('The sale does not cover the loan and the costs' | t) : ('After the loan, the costs and the tax' | t) }}</small>
      </div>
      <div class="stat" data-testid="sale-stat-gain">
        <span>{{ chosen().gain < 0 ? ('The loss' | t) : ('The gain' | t) }}</span>
        <strong>{{ usd(abs(chosen().gain)) }}</strong>
        <small>{{ 'The sale, less its costs, against what you paid' | t }}</small>
      </div>
      <div class="stat" data-testid="sale-stat-tax">
        <span>{{ 'Tax on the gain' | t }}</span>
        <strong>{{ usd(chosen().taxOnGain) }}</strong>
        <small>{{ shelter() }}</small>
      </div>
    </div>

    <dl class="breakdown" data-testid="sale-breakdown" [attr.aria-label]="'From the sale price to what you keep' | t">
      <div><dt>{{ 'The home sells for' | t }}</dt><dd>{{ usd(chosen().homeValue) }}</dd></div>
      <div><dt>{{ 'The loan you pay off' | t }}</dt><dd class="minus">{{ minus(chosen().loanBalance) }}</dd></div>
      <div><dt>{{ 'Selling costs ({0})' | t: [percent(sale().sellingCostPercent)] }}</dt><dd class="minus">{{ minus(chosen().sellingCosts) }}</dd></div>
      <div><dt>{{ 'Tax on the gain' | t }}</dt><dd class="minus">{{ minus(chosen().taxOnGain) }}</dd></div>
      <div class="total"><dt>{{ chosen().netProceeds < 0 ? ('You bring to closing' | t) : ('You walk away with' | t) }}</dt><dd>{{ usd(abs(chosen().netProceeds)) }}</dd></div>
    </dl>

    @if (scenarios().length > 0) {
      <section class="scenarios" data-testid="sale-scenarios" aria-labelledby="sale-scenarios-heading">
        <h3 id="sale-scenarios-heading" data-testid="sale-scenarios-heading">{{ 'If prices differ' | t }}</h3>
        <div class="table-wrap" tabindex="0" [attr.aria-label]="'The sale if prices differ, for the year chosen' | t">
          <table>
            <thead>
              <tr>
                <td></td>
                <th scope="col">{{ 'Sells for' | t }}</th>
                <th scope="col">{{ 'You keep' | t }}</th>
              </tr>
            </thead>
            <tbody>
              @for (s of scenarios(); track s.label) {
                <tr>
                  <th scope="row">{{ s.label }}</th>
                  <td>{{ usd(s.year.homeValue) }}</td>
                  <td [class.short]="s.year.netProceeds < 0">{{ usd(s.year.netProceeds) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="note" data-testid="sale-scenarios-note">{{ 'These are illustrations, not forecasts: nobody knows where prices will go. Set the fall with your numbers.' | t }}</p>
      </section>
    }

    <app-scrub-chart [title]="'What you would walk away with, by the year you sell' | t" [spec]="chart()" testId="sale-chart" />

    <div class="table-wrap" tabindex="0" [attr.aria-label]="'What a sale would leave, year by year' | t">
      <table data-testid="sale-table">
        <thead>
          <tr>
            <td></td>
            <th scope="col">{{ 'Sells for' | t }}</th>
            <th scope="col" class="detail">{{ 'You owe' | t }}</th>
            <th scope="col" class="detail">{{ 'Costs' | t }}</th>
            <th scope="col" class="detail">{{ 'Tax' | t }}</th>
            <th scope="col">{{ 'You keep' | t }}</th>
          </tr>
        </thead>
        <tbody>
          @for (y of milestones(); track y.year) {
            <tr>
              <th scope="row">{{ 'Year {0}' | t: [y.year] }}</th>
              <td>{{ usd(y.homeValue) }}</td>
              <td class="detail">{{ usd(y.loanBalance) }}</td>
              <td class="detail">{{ usd(y.sellingCosts) }}</td>
              <td class="detail">{{ usd(y.taxOnGain) }}</td>
              <td [class.short]="y.netProceeds < 0">{{ usd(y.netProceeds) }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    <p class="note" data-testid="sale-note">{{ note() }}</p>
  `,
  styleUrl: './sale.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaleComponent {
  /** The API's sale, a row for each year of the loan. */
  readonly sale = input.required<SaleOutcome>();

  /** The year the figures are for; null starts on year 5 (or the last year of a shorter loan). */
  protected readonly year = signal<number | null>(null);

  protected readonly usd = usd;
  protected readonly abs = Math.abs;
  protected readonly percent = (value: number) => `${decimal(value)}%`;
  protected readonly minus = (value: number) => (value === 0 ? usd(0) : `− ${usd(value)}`);

  /** The year chosen, or the year the figures start on. */
  protected readonly chosen = computed(() => {
    const years = this.sale().years;
    return years.find((y) => y.year === this.year()) ?? years.find((y) => y.year === STARTING_YEAR) ?? years[years.length - 1];
  });

  /** The chosen year if the home's value changed as each scenario says, then as the plan has it; none when no scenarios were asked for. */
  protected readonly scenarios = computed(() => {
    const { scenarios } = this.sale();
    if (scenarios.length === 0) return [];
    const at = (years: SaleYear[]) => years.find((y) => y.year === this.chosen().year) ?? years[years.length - 1];
    return [
      ...scenarios.map((s) => ({ label: this.scenarioLabel(s.yearlyChangePercent), year: at(s.years) })),
      { label: t('As planned'), year: this.chosen() },
    ];
  });

  /** A scenario's name: "Prices fall 3% a year", "Prices stay flat" or "Prices rise 5% a year". */
  private scenarioLabel(change: number): string {
    if (change === 0) return t('Prices stay flat');
    return change < 0 ? t('Prices fall {0} a year', [this.percent(-change)]) : t('Prices rise {0} a year', [this.percent(change)]);
  }

  /** The milestone years in the table. */
  protected readonly milestones = computed(() => this.sale().years.filter((y) => MILESTONES.includes(y.year)));

  /** Under the tax: how much of the gain the exclusion sheltered, or why none did. */
  protected readonly shelter = computed(() => {
    const { exclusionPerSale } = this.sale();
    const { year, taxFreeGain, gain } = this.chosen();
    if (gain <= 0) return t('A loss is not taxed');
    if (exclusionPerSale === 0) return t('A home you do not live in has no tax-free gain');
    if (year < 2) return t('Tax-free only after two years in the home');
    return taxFreeGain >= gain ? t('All of it is tax-free (up to {0})', [usd(exclusionPerSale)]) : t('{0} of it is tax-free', [usd(taxFreeGain)]);
  });

  /** What the note says: how the gain is figured and taxed, and what it leaves out. */
  protected readonly note = computed(() => {
    const { gainsTaxRatePercent, exclusionPerSale } = this.sale();
    const rate = this.percent(gainsTaxRatePercent);
    const shelter = exclusionPerSale > 0
      ? `${t('A home you live in shelters the first {0} of gain from tax once you have owned it two years.', [usd(exclusionPerSale)])} ${t('Any gain over that is taxed at {0}.', [rate])}`
      : t('A home you do not live in has no tax-free gain, so all of it is taxed at {0}.', [rate]);
    return [
      t('The gain is the sale price less the costs of selling, over the price you paid.'),
      shelter,
      t('What you owe is on your plan, with any extra payments.'),
      t('Improvements and the costs of buying would lower the gain, so the tax shown leans high. State tax, and a loss against other income, are left out.'),
    ].join(' ');
  });

  /** What is drawn: what a sale would leave, for each year it might be made. */
  protected readonly chart = computed<ScrubChartSpec>(() => {
    const years = this.sale().years;
    return {
      labels: years.map((y) => t('Yr {0}', [y.year])),
      series: [{ label: t('You walk away with'), color: '--series-1', data: years.map((y) => y.netProceeds) }],
      title: (index) => tp(years[index].year, 'Selling after {n} year', 'Selling after {n} years'),
      footer: (index) => {
        const y = years[index];
        return t('Sells for {0} · owe {1} · costs {2} · tax {3}', [usd(y.homeValue), usd(y.loanBalance), usd(y.sellingCosts), usd(y.taxOnGain)]);
      },
      tickEvery: 5,
    };
  });
}
