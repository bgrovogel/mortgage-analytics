import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ScrubChartComponent, ScrubChartSpec } from '../../../core/charts/scrub-chart.component';
import { decimal, usd } from '../../../core/formatting/format';
import { RentalOutcome } from '../../../core/models/amortization.models';

/** The years the table shows, of those the loan runs. */
const MILESTONES = [1, 2, 3, 5, 7, 10, 15, 20, 30];

/** What a lender asks of the rent: it should cover the loan's payments one and a quarter times. */
const LENDER_COVERAGE = 1.25;

/**
 * The home let out, measured as an investment: the first year's cash flow, cap rate and cash-on-cash return, the other
 * measures an investor reads (coverage, the rent against the price, the rent that breaks even), the cash flow by year
 * in a chart, and the milestone years in a table, then what is assumed.
 */
@Component({
  selector: 'app-rental',
  imports: [ScrubChartComponent],
  template: `
    <div class="stats">
      <div class="stat" data-testid="rental-stat-cash">
        <span>{{ first().cashFlow < 0 ? 'You add each month' : 'You keep each month' }}</span>
        <strong [class.short]="first().cashFlow < 0">{{ usd(abs(first().cashFlow / 12)) }}</strong>
        <small>{{ usd(abs(first().cashFlow)) }} a year, after the loan</small>
      </div>
      <div class="stat" data-testid="rental-stat-cap">
        <span>Cap rate</span>
        <strong>{{ percent(rental().capRatePercent) }}</strong>
        <small>What the home earns on its price, before the loan</small>
      </div>
      <div class="stat" data-testid="rental-stat-coc">
        <span>Cash-on-cash</span>
        <strong [class.short]="(rental().cashOnCashPercent ?? 0) < 0">{{ rental().cashOnCashPercent === null ? 'None' : percent(rental().cashOnCashPercent!) }}</strong>
        <small>{{ rental().cashOnCashPercent === null ? 'No cash was put in' : 'The cash flow on the ' + usd(rental().cashInvested) + ' you put in' }}</small>
      </div>
    </div>

    <p class="verdict" data-testid="rental-verdict">{{ verdict() }}</p>

    <dl class="measures" data-testid="rental-measures">
      <div><dt>Rent covers the loan</dt><dd>{{ coverage() }}</dd></div>
      <div><dt>Rent against the price</dt><dd>{{ percent(rental().rentToPricePercent) }} a month</dd></div>
      <div><dt>Price over a year's rent</dt><dd>{{ decimal(rental().grossRentMultiplier) }} times</dd></div>
      <div><dt>Rent that breaks even</dt><dd>{{ usd(rental().breakEvenMonthlyRent) }} a month</dd></div>
    </dl>

    <app-scrub-chart title="What the home leaves you each year after the loan (below zero, you add money)" [spec]="chart()" testId="rental-chart" />

    <div class="table-wrap" tabindex="0" aria-label="The home let out, year by year">
      <table data-testid="rental-table">
        <thead>
          <tr>
            <td></td>
            <th scope="col" class="detail">Rent</th>
            <th scope="col">Earns</th>
            <th scope="col" class="detail">Loan</th>
            <th scope="col">Cash flow</th>
          </tr>
        </thead>
        <tbody>
          @for (y of milestones(); track y.year) {
            <tr>
              <th scope="row">Year {{ y.year }}</th>
              <td class="detail">{{ usd(y.grossRent) }}</td>
              <td>{{ usd(y.netOperatingIncome) }}</td>
              <td class="detail">{{ usd(y.debtService) }}</td>
              <td [class.short]="y.cashFlow < 0">{{ usd(y.cashFlow) }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    <p class="note" data-testid="rental-note">{{ note() }}</p>
  `,
  styleUrl: './rental.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RentalComponent {
  /** The API's rental, a row for each year of the loan. */
  readonly rental = input.required<RentalOutcome>();

  protected readonly usd = usd;
  protected readonly decimal = decimal;
  protected readonly abs = Math.abs;
  protected readonly percent = (value: number) => `${decimal(value)}%`;

  protected readonly first = computed(() => this.rental().years[0]);

  /** The milestone years in the table. */
  protected readonly milestones = computed(() => this.rental().years.filter((y) => MILESTONES.includes(y.year)));

  /** How well the rent covers the loan's payments, in the lender's terms. */
  protected readonly coverage = computed(() => {
    const ratio = this.rental().debtServiceCoverage;
    if (ratio === null) return 'No loan to cover';
    return `${decimal(ratio)} times${ratio >= LENDER_COVERAGE ? '' : ` (lenders ask ${LENDER_COVERAGE})`}`;
  });

  /** The one-sentence answer: whether the rent carries the home, and from when. */
  protected readonly verdict = computed(() => {
    const years = this.rental().years;
    const firstPositive = years.findIndex((y) => y.cashFlow >= 0);
    if (firstPositive === 0) return 'The rent pays for the home from the first year, with something left over.';
    if (firstPositive === -1) return `The rent never quite pays for the home in the ${years.length} years: you would add money every year.`;
    return `The rent does not pay for the home at first; from year ${years[firstPositive].year} it does.`;
  });

  /** What is drawn: the cash flow after the loan, for each year. */
  protected readonly chart = computed<ScrubChartSpec>(() => {
    const years = this.rental().years;
    return {
      labels: years.map((y) => `Yr ${y.year}`),
      series: [{ label: 'Cash flow', color: '--series-1', data: years.map((y) => y.cashFlow) }],
      title: (index) => `Year ${years[index].year}`,
      footer: (index) => {
        const y = years[index];
        return `Rent ${usd(y.grossRent)} · earns ${usd(y.netOperatingIncome)} · loan ${usd(y.debtService)}`;
      },
      tickEvery: 5,
    };
  });

  /** What is assumed and what is left out. */
  protected readonly note = computed(() => {
    const r = this.rental();
    return `Rent of ${usd(r.monthlyRent)} a month, rising ${this.percent(r.rentIncreasePercent)} a year, less ${this.percent(r.vacancyPercent)} lost to vacancy. `
      + `A manager takes ${this.percent(r.managementPercent)} of what is collected, and upkeep is ${this.percent(r.maintenancePercent)} of the home's value a year, `
      + `on top of the property taxes, insurance and dues you entered. The loan is the standard schedule, with its mortgage insurance: extra payments are left out. `
      + `Income tax, depreciation and the home's growth in value are left out.`;
  });
}
