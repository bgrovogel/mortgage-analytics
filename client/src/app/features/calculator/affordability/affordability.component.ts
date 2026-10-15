import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { decimal, usd } from '../../../core/formatting/format';
import { Affordability, AffordabilityLimit, LoanProgramType, QualifyingRateBasis } from '../../../core/models/amortization.models';

/** How a sentence names each program's loan. */
const LOAN: Record<LoanProgramType, string> = { Conventional: 'a conventional loan', Fha: 'an FHA loan', Va: 'a VA loan' };

/** How far each program can go past its usual limit, and on what. */
const STRETCH: Record<LoanProgramType, string> = {
  Conventional: 'Fannie Mae allows 45% with good credit and reserves, and up to 50% through its automated underwriting.',
  Fha: 'HUD allows up to 40% and 50% with compensating factors, such as cash reserves.',
  Va: 'Past 41%, VA asks for 20% more residual income than its guideline.',
};

/** Why an adjustable rate is qualified above where it starts, after its qualifying rate. */
const ABOVE_START: Record<Exclude<QualifyingRateBasis, 'NoteRate'>, string> = {
  MostInFirstFiveYears: 'the most it can reach in its first five years',
  FirstResetOrFullyIndexed: 'the higher of its rate after the first change at the cap and the rate it is expected to reset to',
  StartPlusOnePoint: 'a point above its starting rate, since it can change every year and less than 5% is down',
};

/** "28% and 36%", or "45%" when only the total is limited. */
const percents = (l: AffordabilityLimit, join = ' and ') =>
  l.housingPercent === null ? `${decimal(l.totalPercent)}%` : `${decimal(l.housingPercent)}%${join}${decimal(l.totalPercent)}%`;

/**
 * Can you afford it: this home's payment against the household's income, with and without its other debts, as a
 * lender measures it, then each limit (the comfortable 28%/36%, and the most the loan program allows) with what it
 * allows for housing, the highest price it reaches, and whether this home fits.
 */
@Component({
  selector: 'app-affordability',
  template: `
    <h2 id="affordability-title">Can you afford it?</h2>
    <p class="budget" data-testid="afford-budget">{{ budget() }}</p>
    <p class="intro" data-testid="afford-intro">{{ intro() }}</p>
    <p class="verdict" [class.warn]="!affordability().mostAllowed.fits" data-testid="afford-verdict">{{ verdict() }}</p>
    <table aria-labelledby="affordability-title" data-testid="affordability">
      <thead>
        <tr>
          <td></td>
          <th scope="col" class="limit">Limit</th>
          <th scope="col">Most for housing</th>
          <th scope="col">Highest price</th>
          <th scope="col">This home</th>
        </tr>
      </thead>
      <tbody>
        @for (row of rows(); track row.name) {
          <tr>
            <th scope="row">{{ row.name }}<small class="limit-under">{{ row.limit }}</small></th>
            <td class="limit">{{ row.limit }}</td>
            <td>{{ row.housing }}</td>
            <td>{{ row.price }}</td>
            <td [class.fits]="row.fits" [class.past]="!row.fits">{{ row.fits ? 'Fits' : 'Past it' }}</td>
          </tr>
        }
      </tbody>
    </table>
    <p class="note" data-testid="afford-note">
      The highest price keeps this home’s {{ downPercent() }}% down, rate, taxes and insurance. {{ stretch() }} {{ rateNote() }}
    </p>
  `,
  styleUrl: './affordability.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AffordabilityComponent {
  /** The API's measure of the home against the household. */
  readonly affordability = input.required<Affordability>();

  /** The loan's program, whose limit is the most allowed. */
  readonly program = input<LoanProgramType>('Conventional');

  /** The down payment as a percentage of the price, which the highest prices keep. */
  readonly downPaymentPercent = input.required<number>();

  protected readonly downPercent = computed(() => decimal(this.downPaymentPercent(), 1));
  protected readonly stretch = computed(() => STRETCH[this.program()]);

  /** The rate the payment is counted at: the note rate, or an adjustable rate's qualifying rate and why. */
  protected readonly rateNote = computed(() => {
    const { qualifyingRate, qualifyingRateBasis } = this.affordability();
    return qualifyingRateBasis === 'NoteRate'
      ? 'Lenders count the payment at the note rate, even with a buydown.'
      : `Lenders count this adjustable rate’s payment at ${decimal(qualifyingRate, 3)}%, ${ABOVE_START[qualifyingRateBasis]}.`;
  });

  /** What the household could buy at all, before this home: the answer to "how much house can I afford?". */
  readonly budget = computed(() => {
    const { comfortable, mostAllowed } = this.affordability();
    const loan = LOAN[this.program()];
    const most = `the most ${loan} allows`;
    if (comfortable.maxHomePrice > 0 && mostAllowed.maxHomePrice > 0) {
      return `You could buy a home up to ${usd(comfortable.maxHomePrice)} and stay within the comfortable limits, or up to ${usd(mostAllowed.maxHomePrice)} at ${most}.`;
    }
    if (mostAllowed.maxHomePrice > 0) {
      return `Your debts leave no room for a home within the comfortable limits; ${most} is ${usd(mostAllowed.maxHomePrice)}.`;
    }
    return 'Your debts leave no room for a mortgage at these limits.';
  });

  readonly intro = computed(() => {
    const a = this.affordability();
    const share = `This home’s payment, ${usd(a.housingPayment)} a month with taxes, insurance and mortgage insurance, is `
      + `${decimal(a.housingPercent)}% of your ${usd(a.monthlyIncome)} monthly income`;
    return a.monthlyDebts > 0 ? `${share}, and ${decimal(a.totalPercent)}% with your ${usd(a.monthlyDebts)} of other debts.` : `${share}.`;
  });

  readonly verdict = computed(() => {
    const { comfortable, mostAllowed } = this.affordability();
    const most = `the most ${LOAN[this.program()]} allows, ${percents(mostAllowed)}`;
    if (comfortable.fits) return `This home is within the comfortable ${percents(comfortable)}.`;
    if (mostAllowed.fits) return `This home is past the comfortable ${percents(comfortable)}, but within ${most}.`;
    return `This home is past ${most}: a lender would not lend this much on this income.`;
  });

  readonly rows = computed(() => {
    const { comfortable, mostAllowed } = this.affordability();
    const row = (name: string, l: AffordabilityLimit, limit: string) => ({
      name, limit, housing: usd(l.maxHousingPayment), price: l.maxHomePrice > 0 ? usd(l.maxHomePrice) : 'None', fits: l.fits,
    });
    return [
      row('Comfortable', comfortable, percents(comfortable, ' · ')),
      row(`Most ${LOAN[this.program()]} allows`, mostAllowed,
        mostAllowed.housingPercent === null ? `${decimal(mostAllowed.totalPercent)}% in all` : percents(mostAllowed, ' · ')),
    ];
  });
}
