import { ChangeDetectionStrategy, Component, ElementRef, computed, input, viewChild } from '@angular/core';
import { hostChart } from '../../../core/charts/chart-host';
import { buildLineChart } from '../../../core/charts/line-chart';
import { decimal, usd } from '../../../core/formatting/format';
import { RentOrBuyComparison } from '../../../core/models/amortization.models';

/** The years the table shows, of those compared. */
const MILESTONES = [1, 3, 5, 7, 10, 15, 20, 30];

/**
 * Buying against renting: how long to stay for buying to come out ahead, what each household is worth year by year
 * (a chart), and the milestone years in a table, then what is assumed and left out.
 */
@Component({
  selector: 'app-rent-or-buy',
  template: `
    <p class="verdict" data-testid="rent-or-buy-verdict">{{ verdict() }}</p>
    <figure>
      <figcaption id="rent-or-buy-chart-title">How far buying is ahead of renting (below zero, renting is ahead)</figcaption>
      <div class="canvas-wrap">
        <canvas #canvas role="img" aria-labelledby="rent-or-buy-chart-title" data-testid="rent-or-buy-chart"></canvas>
      </div>
    </figure>
    <div class="table-wrap" tabindex="0" aria-label="Buying and renting, year by year">
      <table data-testid="rent-or-buy">
        <thead>
          <tr>
            <td></td>
            <th scope="col">Owning that year</th>
            <th scope="col">Rent that year</th>
            <th scope="col">If you buy</th>
            <th scope="col">If you rent</th>
            <th scope="col">Ahead</th>
          </tr>
        </thead>
        <tbody>
          @for (y of milestones(); track y.year) {
            <tr>
              <th scope="row">Year {{ y.year }}</th>
              <td>{{ usd(y.ownershipCost) }}</td>
              <td>{{ usd(y.rent) }}</td>
              <td>{{ usd(y.buyerNetWorth) }}</td>
              <td>{{ usd(y.renterNetWorth) }}</td>
              <td [class.buy]="y.advantage >= 0">{{ y.advantage >= 0 ? 'Buy' : 'Rent' }} by {{ usd(abs(y.advantage)) }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    <p class="note" data-testid="rent-or-buy-note">
      The renter invests the {{ usd(comparison().cashToClose) }} buying would take to close, and each month whichever costs
      less invests the difference, at {{ percent(comparison().investmentReturnPercent) }} a year. Owning includes
      {{ percent(comparison().maintenancePercent) }} of the home’s value a year in upkeep, and
      {{ percent(comparison().sellingCostPercent) }} to sell. Taxes on investment gains, the mortgage interest deduction and
      extra payments are left out.
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

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  /** How long to stay for buying to come out ahead, or that renting stays ahead. */
  readonly verdict = computed(() => {
    const { breakEvenYear, years } = this.comparison();
    if (breakEvenYear === 1) return 'Buying comes out ahead from the first year.';
    if (breakEvenYear !== null) {
      return `Buying comes out ahead if you stay ${breakEvenYear} years or more; before that, renting leaves you better off.`;
    }
    const last = years[years.length - 1];
    return `Renting stays ahead for all ${years.length} years: by the end, it leaves you ${usd(-last.advantage)} better off.`;
  });

  /** The milestone years compared. */
  readonly milestones = computed(() => this.comparison().years.filter((y) => MILESTONES.includes(y.year)));

  constructor() {
    hostChart(
      () => this.canvas().nativeElement,
      (host) => {
        const years = this.comparison().years;
        return buildLineChart(
          {
            labels: years.map((y) => `Yr ${y.year}`),
            // The two households' worth grow so large that the gap between them, the answer, is lost: plot the gap,
            // which crosses zero where buying breaks even.
            series: [{ label: 'Buying ahead by', color: '--series-1', data: years.map((y) => y.advantage) }],
            title: (index) => `Year ${years[index].year}`,
            footer: (index) => {
              const y = years[index];
              return `If you buy ${usd(y.buyerNetWorth)} · if you rent ${usd(y.renterNetWorth)}`;
            },
          },
          host,
        );
      },
    );
  }
}
