import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { decimal, usd } from '../../../core/formatting/format';
import { Affordability, AffordabilityLimit, Buyer, LoanProgramType, QualifyingRateBasis } from '../../../core/models/amortization.models';
import { TPipe } from '../../../core/i18n/t.pipe';

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
  imports: [TPipe],
  selector: 'app-affordability',
  template: `
    <h2 id="affordability-title" class="visually-hidden">{{ 'Can you afford it?' | t }}</h2>
    <div class="stats">
      <div class="stat" data-testid="afford-stat-housing">
        <span>{{ 'Housing payment, as a share of income' | t }}</span>
        <strong>{{ pct(affordability().housingPercent) }}</strong>
        <small [class.ok]="stats().housingFits">{{ '{0} the {1} guideline' | t: [(stats().housingFits ? ('Under' | t) : ('Past' | t)), (pct(affordability().comfortable.housingPercent ?? 28))] }}</small>
      </div>
      <div class="stat" data-testid="afford-stat-total">
        <span>{{ 'With your other debts' | t }}</span>
        <strong>{{ pct(affordability().totalPercent) }}</strong>
        <small [class.ok]="stats().totalFits">{{ '{0} the {1} guideline' | t: [(stats().totalFits ? ('Under' | t) : ('Past' | t)), pct(affordability().comfortable.totalPercent)] }}</small>
      </div>
      <div class="stat" data-testid="afford-stat-most">
        <span>{{ 'The most you could pay for a home' | t }}</span>
        <strong>{{ affordability().comfortable.maxHomePrice > 0 ? usd(affordability().comfortable.maxHomePrice) : ('None' | t) }}</strong>
        <small>{{ 'Up to {0} if a lender stretches' | t: [usd(affordability().mostAllowed.maxHomePrice)] }}</small>
      </div>
    </div>
    <div class="position" data-testid="afford-position" role="img" [attr.aria-label]="positionLabel()">
      <div class="track">
        <div class="comfortable" [style.width.%]="position().comfortable"></div>
        <div class="stretch" [style.left.%]="position().comfortable" [style.width.%]="100 - position().comfortable"></div>
        @if (position().home !== null) {
          <div class="marker" [style.left.%]="position().home"></div>
        }
      </div>
      <div class="labels">
        @if (homePrice() !== null) {
          <span class="here">{{ 'This home {0}' | t: [usd(homePrice()!)] }}</span>
        }
        <span>{{ 'Comfortable {0}' | t: [usd(affordability().comfortable.maxHomePrice)] }}</span>
        <span>{{ 'Most {0}' | t: [usd(affordability().mostAllowed.maxHomePrice)] }}</span>
      </div>
    </div>
    <p class="budget" data-testid="afford-budget">{{ budget() }}</p>
    <p class="intro" data-testid="afford-intro">{{ intro() }}</p>
    <p class="verdict" [class.warn]="!affordability().mostAllowed.fits" data-testid="afford-verdict">{{ verdict() }}</p>
    <table aria-labelledby="affordability-title" data-testid="affordability">
      <thead>
        <tr>
          <td></td>
          <th scope="col" class="limit">{{ 'Limit' | t }}</th>
          <th scope="col">{{ 'Most for housing' | t }}</th>
          <th scope="col">{{ 'Highest price' | t }}</th>
          <th scope="col">{{ 'This home' | t }}</th>
        </tr>
      </thead>
      <tbody>
        @for (row of rows(); track row.name) {
          <tr>
            <th scope="row">{{ row.name }}<small class="limit-under">{{ row.limit }}</small></th>
            <td class="limit">{{ row.limit }}</td>
            <td>{{ row.housing }}</td>
            <td>{{ row.price }}</td>
            <td [class.fits]="row.fits" [class.past]="!row.fits">{{ row.fits ? ('Fits' | t) : ('Past it' | t) }}</td>
          </tr>
        }
      </tbody>
    </table>
    @if (buyers(); as who) {
      <h3 id="buyers-title">{{ 'Who pays what' | t }}</h3>
      <div class="table-wrap">
        <table aria-labelledby="buyers-title" data-testid="afford-buyers">
          <thead>
            <tr>
              <th scope="col" class="name">{{ 'Buyer' | t }}</th>
              <th scope="col">{{ 'Income a month' | t }}</th>
              <th scope="col">{{ 'Debts a month' | t }}</th>
              <th scope="col">{{ 'Down payment' | t }}</th>
              <th scope="col">{{ 'Share of the payment' | t }}</th>
            </tr>
          </thead>
          <tbody>
            @for (b of who.rows; track $index) {
              <tr>
                <th scope="row" class="name">{{ b.name }}</th>
                <td>{{ usd(b.monthlyIncome) }}</td>
                <td>{{ usd(b.monthlyDebts) }}</td>
                <td>{{ pct(b.downPaymentPercent) }} · {{ usd(b.downPayment) }}</td>
                <td>{{ usd(b.monthlyPayment) }}</td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" class="name">{{ 'Together' | t }}</th>
              <td>{{ usd(who.together.monthlyIncome) }}</td>
              <td>{{ usd(who.together.monthlyDebts) }}</td>
              <td>{{ usd(who.together.downPayment) }}</td>
              <td>{{ usd(who.together.monthlyPayment) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p class="note" data-testid="afford-buyers-note">{{ who.note }}</p>
    }
    <p class="note" data-testid="afford-note">
      {{ 'The highest price keeps this home’s {0}% down, rate, taxes and insurance. {1} {2}' | t: [downPercent(), stretch(), rateNote()] }}
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

  /** The home's price in the form, to mark against the limits; null for none. */
  readonly homePrice = input<number | null>(null);

  protected readonly usd = usd;
  protected readonly pct = (value: number) => `${decimal(value)}%`;

  /** Whether each share is within the comfortable guideline (28% for housing, 36% in all). */
  protected readonly stats = computed(() => {
    const a = this.affordability();
    return {
      housingFits: a.housingPercent <= (a.comfortable.housingPercent ?? 28),
      totalFits: a.totalPercent <= a.comfortable.totalPercent,
    };
  });

  /** Where on a bar from $0 to the most a lender allows the comfortable limit and this home sit, in percent. */
  protected readonly position = computed(() => {
    const { comfortable, mostAllowed } = this.affordability();
    const home = this.homePrice();
    const end = Math.max(mostAllowed.maxHomePrice, comfortable.maxHomePrice, home ?? 0, 1);
    const at = (price: number) => Math.min(100, Math.max(0, (price / end) * 100));
    return { comfortable: at(comfortable.maxHomePrice), home: home === null ? null : at(home) };
  });

  protected readonly positionLabel = computed(() => {
    const { comfortable, mostAllowed } = this.affordability();
    const home = this.homePrice();
    return `${home === null ? '' : `This home ${usd(home)}. `}Comfortable up to ${usd(comfortable.maxHomePrice)}; most a lender allows ${usd(mostAllowed.maxHomePrice)}.`;
  });

  protected readonly downPercent = computed(() => decimal(this.downPaymentPercent(), 1));
  protected readonly stretch = computed(() => STRETCH[this.program()]);

  /** The rate the payment is counted at: the note rate, or an adjustable rate's qualifying rate and why. */
  protected readonly rateNote = computed(() => {
    const { qualifyingRate, qualifyingRateBasis } = this.affordability();
    return qualifyingRateBasis === 'NoteRate'
      ? 'Lenders count the payment at the note rate, even with a buydown.'
      : `Lenders count this adjustable rate’s payment at ${decimal(qualifyingRate, 3)}%, ${ABOVE_START[qualifyingRateBasis]}.`;
  });

  /** Each buyer, the first as "You", and all of them together, when there are co-buyers; null for a buyer alone. */
  protected readonly buyers = computed(() => {
    const all = this.affordability().buyers;
    if (!all || all.length < 2) return null;
    const sum = (pick: (b: Buyer) => number) => all.reduce((total, b) => total + pick(b), 0);
    const together = {
      monthlyIncome: sum((b) => b.monthlyIncome), monthlyDebts: sum((b) => b.monthlyDebts),
      downPayment: sum((b) => b.downPayment), monthlyPayment: sum((b) => b.monthlyPayment),
    };
    const yours = decimal((all[0].monthlyIncome / together.monthlyIncome) * 100, 1);
    return {
      rows: all.map((b, i) => ({ ...b, name: i === 0 ? 'You' : `Co-buyer ${i}` })),
      together,
      note: `Each share of the monthly payment follows income: you earn ${yours}% of what you earn together. A lender counts the income and debts `
        + 'of everyone on the loan together, so these ratios are for all of you.',
    };
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
      + `${decimal(a.housingPercent)}% of your ${a.buyers ? 'combined ' : ''}${usd(a.monthlyIncome)} monthly income`;
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
