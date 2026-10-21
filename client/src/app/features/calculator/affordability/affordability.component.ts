import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { decimal, usd } from '../../../core/formatting/format';
import { Affordability, AffordabilityLimit, Buyer, LoanProgramType, QualifyingRateBasis } from '../../../core/models/amortization.models';
import { TPipe } from '../../../core/i18n/t.pipe';
import { t } from '../../../core/i18n/i18n';

/** How a sentence names each program's loan. */
const loanOf = (program: LoanProgramType): string => ({ Conventional: t('a conventional loan'), Fha: t('an FHA loan'), Va: t('a VA loan') })[program];

/** How far each program can go past its usual limit, and on what. */
const stretchOf = (program: LoanProgramType): string =>
  ({
    Conventional: t('Fannie Mae allows 45% with good credit and reserves, and up to 50% through its automated underwriting.'),
    Fha: t('HUD allows up to 40% and 50% with compensating factors, such as cash reserves.'),
    Va: t('Past 41%, VA asks for 20% more residual income than its guideline.'),
  })[program];

/** Why an adjustable rate is qualified above where it starts, after its qualifying rate. */
const aboveStart = (basis: Exclude<QualifyingRateBasis, 'NoteRate'>): string =>
  ({
    MostInFirstFiveYears: t('the most it can reach in its first five years'),
    FirstResetOrFullyIndexed: t('the higher of its rate after the first change at the cap and the rate it is expected to reset to'),
    StartPlusOnePoint: t('a point above its starting rate, since it can change every year and less than 5% is down'),
  })[basis];

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
    const range = t('Comfortable up to {0}; most a lender allows {1}.', [usd(comfortable.maxHomePrice), usd(mostAllowed.maxHomePrice)]);
    return home === null ? range : `${t('This home {0}.', [usd(home)])} ${range}`;
  });

  protected readonly downPercent = computed(() => decimal(this.downPaymentPercent(), 1));
  protected readonly stretch = computed(() => stretchOf(this.program()));

  /** The rate the payment is counted at: the note rate, or an adjustable rate's qualifying rate and why. */
  protected readonly rateNote = computed(() => {
    const { qualifyingRate, qualifyingRateBasis } = this.affordability();
    return qualifyingRateBasis === 'NoteRate'
      ? t('Lenders count the payment at the note rate, even with a buydown.')
      : t('Lenders count this adjustable rate’s payment at {0}%, {1}.', [decimal(qualifyingRate, 3), aboveStart(qualifyingRateBasis)]);
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
      rows: all.map((b, i) => ({ ...b, name: i === 0 ? t('You') : t('Co-buyer {0}', [i]) })),
      together,
      note: t('Each share of the monthly payment follows income: you earn {0}% of what you earn together. A lender counts the income and debts of everyone on the loan together, so these ratios are for all of you.', [yours]),
    };
  });

  /** What the household could buy at all, before this home: the answer to "how much house can I afford?". */
  readonly budget = computed(() => {
    const { comfortable, mostAllowed } = this.affordability();
    const loan = loanOf(this.program());
    if (comfortable.maxHomePrice > 0 && mostAllowed.maxHomePrice > 0) {
      return t('You could buy a home up to {0} and stay within the comfortable limits, or up to {1} at the most {2} allows.', [usd(comfortable.maxHomePrice), usd(mostAllowed.maxHomePrice), loan]);
    }
    if (mostAllowed.maxHomePrice > 0) {
      return t('Your debts leave no room for a home within the comfortable limits; the most {0} allows is {1}.', [loan, usd(mostAllowed.maxHomePrice)]);
    }
    return t('Your debts leave no room for a mortgage at these limits.');
  });

  readonly intro = computed(() => {
    const a = this.affordability();
    const housing = [usd(a.housingPayment), decimal(a.housingPercent), usd(a.monthlyIncome)];
    if (a.monthlyDebts > 0) {
      const debts = [decimal(a.totalPercent), usd(a.monthlyDebts)];
      return a.buyers
        ? t('This home’s payment, {0} a month with taxes, insurance and mortgage insurance, is {1}% of your combined {2} monthly income, and {3}% with your {4} of other debts.', [...housing, ...debts])
        : t('This home’s payment, {0} a month with taxes, insurance and mortgage insurance, is {1}% of your {2} monthly income, and {3}% with your {4} of other debts.', [...housing, ...debts]);
    }
    return a.buyers
      ? t('This home’s payment, {0} a month with taxes, insurance and mortgage insurance, is {1}% of your combined {2} monthly income.', housing)
      : t('This home’s payment, {0} a month with taxes, insurance and mortgage insurance, is {1}% of your {2} monthly income.', housing);
  });

  readonly verdict = computed(() => {
    const { comfortable, mostAllowed } = this.affordability();
    const loan = loanOf(this.program());
    if (comfortable.fits) return t('This home is within the comfortable {0}.', [percents(comfortable)]);
    if (mostAllowed.fits) return t('This home is past the comfortable {0}, but within the most {1} allows, {2}.', [percents(comfortable), loan, percents(mostAllowed)]);
    return t('This home is past the most {0} allows, {1}: a lender would not lend this much on this income.', [loan, percents(mostAllowed)]);
  });

  readonly rows = computed(() => {
    const { comfortable, mostAllowed } = this.affordability();
    const row = (name: string, l: AffordabilityLimit, limit: string) => ({
      name, limit, housing: usd(l.maxHousingPayment), price: l.maxHomePrice > 0 ? usd(l.maxHomePrice) : t('None'), fits: l.fits,
    });
    return [
      row(t('Comfortable'), comfortable, percents(comfortable, ' · ')),
      row(t('Most {0} allows', [loanOf(this.program())]), mostAllowed,
        mostAllowed.housingPercent === null ? t('{0}% in all', [decimal(mostAllowed.totalPercent)]) : percents(mostAllowed, ' · ')),
    ];
  });
}
