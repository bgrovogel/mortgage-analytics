import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder } from '@angular/forms';
import { FieldRules, validatorsFor } from '../../../core/forms/field-rules';
import { NumberFieldComponent } from '../../../core/forms/number-field.component';
import { decimal, pct, usd } from '../../../core/formatting/format';
import { SellerOfferComparison, SellerOfferInput, SellerOfferOption, SellerOfferUse } from '../../../core/models/amortization.models';
import { DEFAULT_OFFER_SETTINGS } from '../calculator.store';
import { TPipe } from '../../../core/i18n/t.pipe';
import { t, tp } from '../../../core/i18n/i18n';

/** How the offer is weighed, with the limits the API enforces (AmortizationRequestValidator). */
const OFFER_RULES = {
  yearsKept: { get label() { return t('Years you keep the loan'); }, unit: 'years', min: 1, max: 50, whole: true },
  rateCutPerPoint: { get label() { return t('Rate cut per point'); }, unit: '%', min: 0.001, max: 1, decimals: 3 },
} as const satisfies FieldRules;

/** Each way's column heading, and how a sentence says taking the offer that way. */
const WAYS: Record<SellerOfferUse, { heading: string; taking: string }> = {
  PriceCut: { get heading() { return t('Off the price'); }, get taking() { return t('off the price'); } },
  ClosingCosts: { get heading() { return t('Toward closing'); }, get taking() { return t('toward closing'); } },
  TemporaryBuydown: { get heading() { return t('2-1 buydown'); }, get taking() { return t('as a 2-1 buydown'); } },
  DiscountPoints: { get heading() { return t('Points'); }, get taking() { return t('as points'); } },
};

/** One row of the table: its label, and each way's figure with an optional line under it. */
interface Row {
  label: string;
  cells: { value: string; under?: string }[];
}

/**
 * The seller's or builder's money taken each way it can be (off the price, toward closing, for a 2-1 buydown, for
 * points) side by side, with what each costs over the years the loan is kept, the least marked. Shows nothing
 * without an offer.
 */
@Component({
  selector: 'app-seller-offer',
  imports: [NumberFieldComponent, TPipe],
  template: `
    <h2 id="seller-offer-title" class="visually-hidden">{{ 'Best use of the seller’s money' | t }}</h2>
    <p class="intro" data-testid="offer-intro">
      {{ 'The seller’s {0}, taken each way it can be, over the {1} you keep the loan: what you bring to closing, pay each month, and still owe after.' | t: [amount(), years()] }}
    </p>
    <!-- How it is weighed, beside what it changes: the years kept, and the rate a point buys. -->
    <div class="settings" data-testid="offer-settings">
      <app-number-field [control]="form.controls.yearsKept" [rule]="rules.yearsKept" testId="years-kept" />
      <app-number-field [control]="form.controls.rateCutPerPoint" [rule]="rules.rateCutPerPoint" testId="rate-cut-per-point" />
    </div>
    <p class="verdict" data-testid="offer-best">{{ verdict() }}</p>
    @if (notUsed(); as note) {
      <p class="note warn" data-testid="offer-not-used">{{ note }}</p>
    }
    <div class="table-wrap" tabindex="0" aria-labelledby="seller-offer-title">
      <table aria-labelledby="seller-offer-title" data-testid="seller-offer">
        <thead>
          <tr>
            <th scope="col"></th>
            @for (o of offer().options; track o.use) {
              <th scope="col" [class.best]="o.use === offer().best">
                {{ heading(o) }} @if (o.use === offer().best) {<span class="badge">{{ 'Least' | t }}</span>}
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.label) {
            <tr>
              <th scope="row">{{ row.label }}</th>
              @for (cell of row.cells; track $index) {
                <td [class.best]="offer().options[$index].use === offer().best">
                  {{ cell.value }} @if (cell.under) {<small>{{ cell.under }}</small>}
                </td>
              }
            </tr>
          }
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">{{ 'Cost over {0}' | t: [years()] }}</th>
            @for (o of offer().options; track o.use) {
              <td [class.best]="o.use === offer().best">{{ usd(o.cost) }}</td>
            }
          </tr>
        </tfoot>
      </table>
    </div>
    <p class="note">
      {{ 'Payments include taxes, insurance, mortgage insurance and dues; a buydown’s first two years are partly paid by the seller. What you still owe is paid when you sell or refinance.' | t }}
    </p>
  `,
  styleUrl: './seller-offer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SellerOfferComponent {
  /** The API's comparison of the ways to take the offer. */
  readonly offer = input.required<SellerOfferComparison>();

  /** How the offer is weighed now. */
  readonly settings = input<SellerOfferInput>(DEFAULT_OFFER_SETTINGS);

  /** Asks to weigh the offer another way: emitted when a setting changes to a value in range. */
  readonly settingsChange = output<SellerOfferInput>();

  protected readonly rules = OFFER_RULES;
  protected readonly form = inject(NonNullableFormBuilder).group({
    yearsKept: [DEFAULT_OFFER_SETTINGS.yearsKept, validatorsFor(OFFER_RULES.yearsKept)],
    rateCutPerPoint: [DEFAULT_OFFER_SETTINGS.rateCutPerPoint, validatorsFor(OFFER_RULES.rateCutPerPoint)],
  });

  constructor() {
    // The fields follow the settings (a saved calculation brings its own) without asking to weigh it again.
    effect(() => {
      const settings = this.settings();
      untracked(() => this.form.setValue(settings, { emitEvent: false }));
    });
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.form.valid) this.settingsChange.emit(this.form.getRawValue());
    });
  }

  protected readonly usd = usd;

  readonly amount = computed(() => usd(this.offer().offer));

  /** "7 years", or "1 year". */
  readonly years = computed(() => tp(this.offer().yearsKept, '{n} year', '{n} years'));

  /** The way that costs the least, and how much less than the next. */
  readonly verdict = computed(() => {
    const { options, best } = this.offer();
    const winner = options.find((o) => o.use === best)!;
    const next = options.filter((o) => o !== winner).sort((a, b) => a.cost - b.cost)[0];
    const lead = t('Taking it {0} costs the least', [WAYS[best].taking]);
    return next
      ? t('{0}: {1} less over {2} than {3}, the next best.', [lead, usd(next.cost - winner.cost), this.years(), WAYS[next.use].taking])
      : t('{0}.', [lead]);
  });

  /** When only part of the offer can pay costs (they are less, or the loan's limit is): how much, and that a price cut uses all of it. */
  readonly notUsed = computed(() => {
    const { offer, options } = this.offer();
    const credited = options.find((o) => o.use === 'ClosingCosts');
    return credited && credited.notUsed > 0
      ? t('Only {0} of it can go toward closing: credits pay no more than your costs, within the loan’s limit. Off the price, all of it counts.', [usd(offer - credited.notUsed)])
      : null;
  });

  readonly rows = computed<Row[]>(() => {
    const options = this.offer().options;
    const years = this.years();
    const each = (cell: (o: SellerOfferOption) => Row['cells'][number]) => options.map(cell);
    return [
      { get label() { return t('Price'); }, cells: each((o) => ({ value: usd(o.homePrice) })) },
      {
        get label() { return t('Rate'); },
        cells: each((o) => ({ value: pct(o.annualInterestRate, 3), under: o.points > 0 ? t('{0} points', [decimal(o.points, 3)]) : undefined })),
      },
      {
        get label() { return t('Monthly payment'); },
        cells: each((o) => ({
          value: usd(o.firstPayment),
          under: o.laterPayment !== o.firstPayment ? t('{0} from year 3', [usd(o.laterPayment)]) : undefined,
        })),
      },
      { get label() { return t('Cash to close'); }, cells: each((o) => ({ value: usd(o.cashToClose) })) },
      { get label() { return t('Payments, {0}', [years]); }, cells: each((o) => ({ value: usd(o.payments) })) },
      { get label() { return t('Owed after {0}', [years]); }, cells: each((o) => ({ value: usd(o.balance) })) },
    ];
  });

  heading(option: SellerOfferOption): string {
    return WAYS[option.use].heading;
  }
}
