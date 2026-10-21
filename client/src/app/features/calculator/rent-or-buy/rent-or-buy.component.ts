import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ScrubChartComponent, ScrubChartSpec } from '../../../core/charts/scrub-chart.component';
import { decimal, usd } from '../../../core/formatting/format';
import { RentOrBuyComparison } from '../../../core/models/amortization.models';
import { TPipe } from '../../../core/i18n/t.pipe';
import { t } from '../../../core/i18n/i18n';

/** The years the table shows, of those compared. */
const MILESTONES = [1, 3, 5, 7, 10, 15, 20, 30];

/**
 * Buying against renting: how long to stay for buying to come out ahead, what each household is worth year by year
 * (a chart), and the milestone years in a table, then what is assumed and left out.
 */
@Component({
  selector: 'app-rent-or-buy',
  imports: [ScrubChartComponent, TPipe],
  template: `
    <div class="stats">
      <div class="stat" data-testid="rent-stat-year">
        <span>{{ 'Buying pulls ahead' | t }}</span>
        <strong>{{ stats().year }}</strong>
        <small>{{ stats().yearNote }}</small>
      </div>
      @if (stats().ten; as ten) {
        <div class="stat" data-testid="rent-stat-ten">
          <span>{{ 'After 10 years' | t }}</span>
          <strong [class.buy]="ten.advantage >= 0">{{ ten.lead }}</strong>
          <small>{{ ten.detail }}</small>
        </div>
      }
      @if (stats().end; as end) {
        <div class="stat" data-testid="rent-stat-end">
          <span>{{ 'After {0} years' | t: [comparison().years.length] }}</span>
          <strong [class.buy]="end.advantage >= 0">{{ end.lead }}</strong>
          <small>{{ end.detail }}</small>
        </div>
      }
    </div>
    <p class="verdict" data-testid="rent-or-buy-verdict">{{ verdict() }}</p>
    <app-scrub-chart [title]="'How far buying is ahead of renting (below zero, renting is ahead)' | t" [spec]="chart()" testId="rent-or-buy-chart" />
    <div class="table-wrap" tabindex="0" [attr.aria-label]="'Buying and renting, year by year' | t">
      <table data-testid="rent-or-buy">
        <thead>
          <tr>
            <td></td>
            <th scope="col" class="yearly">{{ 'Owning that year' | t }}</th>
            <th scope="col" class="yearly">{{ 'Rent that year' | t }}</th>
            <th scope="col">{{ 'If you buy' | t }}</th>
            <th scope="col">{{ 'If you rent' | t }}</th>
            <th scope="col">{{ 'Ahead' | t }}</th>
          </tr>
        </thead>
        <tbody>
          @for (y of milestones(); track y.year) {
            <tr>
              <th scope="row">{{ 'Year {0}' | t: [y.year] }}</th>
              <td class="yearly">{{ usd(y.ownershipCost) }}</td>
              <td class="yearly">{{ usd(y.rent) }}</td>
              <td>{{ usd(y.buyerNetWorth) }}</td>
              <td>{{ usd(y.renterNetWorth) }}</td>
              <td [class.buy]="y.advantage >= 0">{{ y.advantage >= 0 ? ('Buy by {0}' | t: [usd(abs(y.advantage))]) : ('Rent by {0}' | t: [usd(abs(y.advantage))]) }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    <p class="note" data-testid="rent-or-buy-note">
      {{ 'The renter invests the {0} buying would take to close, and each month whichever costs less invests the difference, at {1} a year. Owning includes {2} of the home’s value a year in upkeep, and {3} to sell. {4}' | t: [usd(comparison().cashToClose), percent(comparison().investmentReturnPercent), percent(comparison().maintenancePercent), percent(comparison().sellingCostPercent), taxNote()] }}
    </p>
  `,
  styleUrl: './rent-or-buy.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RentOrBuyComponent {
  /** The API's comparison. */
  readonly comparison = input.required<RentOrBuyComparison>();

  protected readonly usd = usd;
  protected readonly abs = Math.abs;
  protected readonly percent = (value: number) => `${decimal(value)}%`;

  /** What the note says of tax: that the saving of owning is counted, or that the deduction is left out. */
  protected readonly taxNote = computed(() => {
    const { countsTaxSavings, years } = this.comparison();
    if (!countsTaxSavings) {
      return t('Taxes on investment gains, the mortgage interest deduction and extra payments are left out.');
    }
    const total = years.reduce((sum, y) => sum + (y.taxSaved ?? 0), 0);
    return t('It counts the federal tax owning saves: {0} in year 1, and {1} in the {2} years compared. Taxes on investment gains and extra payments are left out.', [usd(years[0]?.taxSaved ?? 0), usd(total), years.length]);
  });


  /** How long to stay for buying to come out ahead, or that renting stays ahead. */
  readonly verdict = computed(() => {
    const { breakEvenYear, years } = this.comparison();
    if (breakEvenYear === 1) return t('Buying comes out ahead from the first year.');
    if (breakEvenYear !== null) {
      return t('Buying comes out ahead if you stay {0} years or more; before that, renting leaves you better off.', [breakEvenYear]);
    }
    const last = years[years.length - 1];
    return t('Renting stays ahead for all {0} years: by the end, it leaves you {1} better off.', [years.length, usd(-last.advantage)]);
  });

  /** The three figures above the verdict: when buying pulls ahead, and where each side stands at 10 years and at the end. */
  protected readonly stats = computed(() => {
    const { breakEvenYear, years } = this.comparison();
    const standing = (y: { advantage: number; buyerNetWorth: number; renterNetWorth: number }) => ({
      advantage: y.advantage,
      lead: y.advantage >= 0 ? t('Buy by {0}', [usd(Math.abs(y.advantage))]) : t('Rent by {0}', [usd(Math.abs(y.advantage))]),
      detail: t('{0} bought vs {1} rented', [usd(y.buyerNetWorth), usd(y.renterNetWorth)]),
    });
    const ten = years.find((y) => y.year === 10);
    const last = years[years.length - 1];
    return {
      year: breakEvenYear === null ? t('Never') : t('Year {0}', [breakEvenYear]),
      yearNote: breakEvenYear === null
        ? t('Renting is ahead in all {0} years', [years.length])
        : breakEvenYear === 1 ? t('Ahead from the start') : t('And stays ahead every year after'),
      ten: ten ? standing(ten) : null,
      end: last ? standing(last) : null,
    };
  });

  /** The milestone years compared. */
  readonly milestones = computed(() => this.comparison().years.filter((y) => MILESTONES.includes(y.year)));

  /** What is drawn: the gap between the two households, which crosses zero where buying breaks even. */
  readonly chart = computed<ScrubChartSpec>(() => {
    const years = this.comparison().years;
    return {
      labels: years.map((y) => t('Yr {0}', [y.year])),
      // The two households' worth grow so large that the gap between them, the answer, is lost: plot the gap.
      series: [{ label: t('Buying ahead by'), color: '--series-1', data: years.map((y) => y.advantage) }],
      title: (index) => t('Year {0}', [years[index].year]),
      footer: (index) => {
        const y = years[index];
        return t('If you buy {0} · if you rent {1}', [usd(y.buyerNetWorth), usd(y.renterNetWorth)]);
      },
      tickEvery: 5,
    };
  });
}
