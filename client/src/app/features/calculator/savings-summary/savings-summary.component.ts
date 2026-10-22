import { CurrencyPipe } from '@angular/common';
import { DatePipe } from '../../../core/i18n/date.pipe';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TermComponent } from '../../../core/glossary/term.component';
import { FormNavigator } from '../../../core/forms/form-navigator';
import { formatMonths } from '../../../core/formatting/duration';
import { decimal, usd, usdCents } from '../../../core/formatting/format';
import { AmortizationResponse, HousingCosts, Payment } from '../../../core/models/amortization.models';
import { mortgageInsuranceName } from '../../../core/models/cost-categories';
import { DialogComponent } from '../../../core/layout/dialog.component';
import { PaymentBreakdownComponent } from '../payment-breakdown/payment-breakdown.component';
import { KPI_LABELS, KpiKey, KpiPreferences } from './kpi-preferences';
import { ProvenanceChipsComponent } from '../provenance/provenance-chips.component';
import { buydownYears } from '../rate-plan/buydown-years';
import { TPipe } from '../../../core/i18n/t.pipe';
import { msg, t } from '../../../core/i18n/i18n';

/** Each tax, as the payment tile names it when it is the only one. */
const TAXES: readonly [keyof HousingCosts, string][] = [
  ['propertyTax', msg('property tax')],
  ['schoolTax', msg('school tax')],
  ['localTax', msg('county/city tax')],
  ['mudTax', msg('MUD tax')],
];

/**
 * The answer tiles: the monthly payment, the cash to close, whether you can afford it, and what paying extra saves,
 * each linking to its details; then when the loan and its mortgage insurance end. Stat tiles rather than a chart,
 * because each is a single value.
 */
@Component({
  selector: 'app-savings-summary',
  imports: [CurrencyPipe, DatePipe, DialogComponent, PaymentBreakdownComponent, ProvenanceChipsComponent, RouterLink, TermComponent, TPipe],
  template: `
    @let r = result();
    @if (r.purchase.isJumbo) {
      <p class="notice" data-testid="jumbo-notice">
        {{ 'This is a jumbo loan: above the {0} conforming limit. Jumbo loans have stricter rules, often more down and more in reserve, and are priced on their own, so lenders’ quotes can differ more than usual.' | t: [(r.purchase.conformingLoanLimit | currency: 'USD' : 'symbol' : '1.0-0')] }}
      </p>
    }
    <!-- What each month is made of, in a line and as a bar: the hero figure above is its total. -->
    <section class="payment" [attr.aria-label]="'What each month is made of' | t" data-testid="payment-parts">
      <p class="parts">
        <span data-testid="monthly-payment">{{ firstPayment().loan | currency }}</span>&ngsp;<abbr [attr.title]="'principal and interest' | t">{{ 'P&I' | t }}</abbr>
        @if (firstPayment().costs.total > 0) {
          &ngsp;{{ '+ {0}' | t: [(firstPayment().costs.total | currency)] }} <span data-testid="housing-costs-label">{{ housingCostsLabel() }}</span>
        }
        @if (r.annualPercentageRate; as apr) {
          &ngsp;· <span data-testid="apr"><app-term of="APR">{{ 'APR' | t }}</app-term> {{ percent(apr) }}%</span>
        }
      </p>
      <app-provenance-chips [result]="r" />
      @if (r.buydown) {
        <p class="extra" data-testid="buydown-first-year">{{ 'In year 1, with the buydown; {0}' | t: [fromNoteRate()] }}</p>
      }
      @if (withExtra(); as extra) {
        <p class="extra" data-testid="with-extra">{{ '+ {0} extra = {1}' | t: [(extra.amount | currency: 'USD' : 'symbol' : '1.0-0'), (extra.total | currency)] }}</p>
      }
      <!-- Where it goes: a bar of the parts, with each one's figure and share. -->
      <app-payment-breakdown [schedule]="r.accelerated" [principalAndInterest]="r.buydown?.years?.[0]?.monthlyPayment ?? null"
                             [current]="current()" [program]="r.program ?? null" />
    </section>

    <!-- What it takes to close, when it is paid off, what paying extra saves and when the insurance ends, in one rail
         (a dl allows only dt and dd, so a figure's notes are more dd elements). -->
    <dl class="rail">
      <!-- In the reader's order, and only the figures they keep (Arrange). Each applies when the loan has it. -->
      @for (key of figures(); track key) {
        @switch (key) {
          @case ('cash') {
          @if (cash(); as cash) {
            <div class="tile" data-testid="cash-tile">
              <dt>{{ 'Cash to close' | t }}</dt>
              <dd data-testid="cash-tile-total">{{ cash.total | currency }}</dd>
              <dd class="note">
                {{ '{0} down + {1} closing costs' | t: [(cash.downPayment | currency), (cash.closingCosts | currency)] }}
                @if (cash.credits > 0) {
                  {{ '− {0} credits' | t: [(cash.credits | currency)] }}
                }
              </dd>
              <dd class="link"><a routerLink="/calculator/closing" data-testid="cash-tile-link">{{ 'See the costs →' | t }}</a></dd>
            </div>
          }
          }
          @case ('payoff') {
          <!-- When it is paid off, and how much sooner: one tile, so the date and the time saved are not said twice. -->
          <div class="tile">
            <dt>{{ 'Paid off' | t }}</dt>
            <dd data-testid="payoff-date">{{ r.savings.acceleratedPayoffDate | date: 'MMM yyyy' }}</dd>
            @if (r.savings.paymentsSaved > 0) {
              <dd class="note gain"><span data-testid="time-saved">{{ timeSaved() }}</span> {{ 'sooner, instead of {0}' | t: [(r.savings.originalPayoffDate | date: 'MMM yyyy')] }}</dd>
            } @else if (r.accelerated.recasts.length > 0) {
              <dd class="note" data-testid="same-payoff">{{ 'Same date: a recast lowers the payment instead' | t }}</dd>
            }
          </div>
          }
          @case ('afford') {
          @if (!current()) {
            <div class="tile" data-testid="afford-tile">
              <dt>{{ 'Can you afford it?' | t }}</dt>
              @if (afford(); as a) {
                <dd [class.gain]="a.good" data-testid="afford-tile-answer">{{ a.answer }}</dd>
                <dd class="note" data-testid="afford-tile-note">{{ a.note }}</dd>
                <dd class="link"><a routerLink="/calculator/affordability" data-testid="afford-tile-link">{{ 'How lenders see it →' | t }}</a></dd>
              } @else {
                <dd class="note">{{ 'Your income and debts tell whether this home fits, and the most you could pay.' | t }}</dd>
                <dd class="link"><button type="button" (click)="addIncome()" data-testid="afford-tile-add">{{ 'Add income' | t }}</button></dd>
              }
            </div>
          }
          }
          @case ('savings') {
          @if (hasSavings()) {
            <div class="tile savings positive" data-testid="savings-tile">
              <dt>{{ 'Net savings from paying extra' | t }}</dt>
              <dd data-testid="net-savings">{{ r.savings.netSavings | currency: 'USD' : 'symbol' : '1.0-0' }}</dd>
              @if (savingsDetail(); as detail) {
                <dd class="note" data-testid="savings-detail">{{ detail }}</dd>
              }
              <!-- &ngsp; keeps the space between the two spans, which Angular would otherwise drop as whitespace-only. -->
              <dd class="note">{{ 'Total interest' | t }} <span data-testid="total-interest">{{ r.accelerated.totalInterest | currency: 'USD' : 'symbol' : '1.0-0' }}</span>&ngsp;<span data-testid="total-interest-detail">{{ 'instead of {0}' | t: [(r.baseline.totalInterest | currency: 'USD' : 'symbol' : '1.0-0')] }}</span></dd>
              @if (buydownNote(); as note) {
                <dd class="note" data-testid="interest-you-pay">{{ note }}</dd>
              }
            </div>
          } @else {
            <!-- Nothing extra is paid, so a $0 saving would say nothing: say what the loan costs instead. -->
            <div class="tile savings" data-testid="savings-tile">
              <dt>{{ 'Total interest over the loan' | t }}</dt>
              <dd data-testid="total-interest">{{ r.baseline.totalInterest | currency: 'USD' : 'symbol' : '1.0-0' }}</dd>
              <dd class="note" data-testid="total-interest-detail">{{ 'Add an extra payment to see how much you could save.' | t }}</dd>
              @if (buydownNote(); as note) {
                <dd class="note" data-testid="interest-you-pay">{{ note }}</dd>
              }
            </div>
          }
          }
          @case ('pmi') {
          @if (r.accelerated.mortgageInsuranceEndDate; as pmiEnd) {
            <div class="tile">
              <dt>{{ '{0} ends' | t: [insuranceName()] }}</dt>
              <dd data-testid="pmi-end">{{ pmiEnd | date: 'MMM yyyy' }}</dd>
              <!-- Kept for the life of the loan (FHA MIP with under 10% down), it ends with the payoff tile's date. -->
              @if (pmiEnd.slice(0, 7) === r.savings.acceleratedPayoffDate.slice(0, 7)) {
                <dd class="note" data-testid="pmi-with-loan">{{ 'Lasts as long as the loan, so paying it off sooner ends it too' | t }}</dd>
              } @else if (r.baseline.mortgageInsuranceEndDate !== pmiEnd) {
                <dd class="note gain" data-testid="pmi-sooner">{{ '{0} sooner, instead of {1}' | t: [pmiSooner(), (r.baseline.mortgageInsuranceEndDate | date: 'MMM yyyy')] }}</dd>
              } @else {
                <dd class="note">{{ '{0}% down' | t: [r.purchase.downPaymentPercent] }}</dd>
              }
              <!-- Automatic removal keeps to the original schedule, whatever is paid extra; asking at 80% does not. -->
              @if (r.pmiOtherChoice; as other) {
                <dd class="note ask" data-testid="pmi-other-choice">
                  @if (other.removal === 'BorrowerRequested') {
                    {{ 'Ask your lender at 80%: ends {0}, saving {1}' | t: [(other.endDate | date: 'MMM yyyy'), (other.savedByAsking | currency: 'USD' : 'symbol' : '1.0-0')] }}
                  } @else {
                    <!-- Automatic removal is the latest the law requires; some servicers drop it sooner, but none has to. -->
                    {{ "If you don't ask, your servicer only has to remove it in {0}, costing {1} more" | t: [(other.endDate | date: 'MMM yyyy'), (other.savedByAsking | currency: 'USD' : 'symbol' : '1.0-0')] }}
                  }
                </dd>
              }
            </div>
          }
          }
        }
      }
    </dl>

    <div class="arrange">
      <button type="button" data-testid="arrange-rail" (click)="arranging.open()">{{ 'Arrange these figures' | t }}</button>
    </div>
    <app-dialog #arranging [heading]="'Your key figures' | t">
      <p class="arrange-hint">{{ 'Put them in the order you read them, and put away the ones you do not need. This browser remembers it; signed in, so does your account, on every device.' | t }}</p>
      <ul class="arrange-list" data-testid="arrange-list">
        @for (key of preferences.order(); track key; let first = $first; let last = $last) {
          <li>
            <label>
              <input type="checkbox" [checked]="!preferences.hidden().has(key)" (change)="preferences.toggle(key)" [attr.data-testid]="'kpi-show-' + key" />
              {{ labels[key] }}
            </label>
            <span class="moves">
              <button type="button" [disabled]="first" [attr.aria-label]="'Move {0} earlier' | t: [labels[key]]" (click)="moved(key, -1)">↑</button>
              <button type="button" [disabled]="last" [attr.aria-label]="'Move {0} later' | t: [labels[key]]" (click)="moved(key, 1)">↓</button>
            </span>
          </li>
        }
      </ul>
      <p class="visually-hidden" role="status" aria-live="polite" data-testid="arrange-status">{{ arrangeStatus() }}</p>
      <button type="button" class="reset" data-testid="arrange-reset" (click)="preferences.reset()">{{ 'Back to the default' | t }}</button>
    </app-dialog>

    @if (r.accelerated.recasts.length > 0) {
      <ul class="recasts" data-testid="recasts">
        @for (recast of r.accelerated.recasts; track recast.afterPaymentNumber) {
          <li>
            <strong>{{ 'Recast after payment {0}' | t: [recast.afterPaymentNumber] }}</strong>{{ ': payment drops from {0} to {1} starting {2}' | t: [(recast.previousPayment | currency), (recast.newPayment | currency), (recast.effectiveDate | date: 'MMM yyyy')] }}
            @if (recast.fee > 0) {
              {{ '({0} fee)' | t: [(recast.fee | currency: 'USD' : 'symbol' : '1.0-0')] }}
            }
          </li>
        }
      </ul>
    }
  `,
  styleUrl: './savings-summary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SavingsSummaryComponent {
  /** A rate to three places without trailing zeros: 6.376, 6.5. */
  protected readonly percent = (value: number) => decimal(value, 3);

  /** The analysis to summarize. */
  readonly result = input.required<AmortizationResponse>();

  private readonly navigator = inject(FormNavigator);
  protected readonly preferences = inject(KpiPreferences);
  protected readonly labels = KPI_LABELS;

  /** The figures of the rail, in the reader's order, without the ones they have put away. */
  protected readonly figures = computed(() => this.preferences.visible());

  /** What the arranging dialog just did, said for a screen reader: where a figure now stands. */
  protected readonly arrangeStatus = signal('');

  /** Moves a figure earlier or later, and says where it stands now. */
  protected moved(key: KpiKey, by: -1 | 1): void {
    this.preferences.move(key, by);
    const order = this.preferences.order();
    this.arrangeStatus.set(t('{0} is now {1} of {2}.', [KPI_LABELS[key], order.indexOf(key) + 1, order.length]));
  }

  /** The cash to close, for a purchase still ahead; null for a loan already being paid, or without closing costs. */
  readonly cash = computed(() => (this.current() ? null : this.result().cashToClose ?? null));

  /**
   * Can you afford it, in a word and a line: within the comfortable 28% and 36%, past them but within what the loan
   * allows, or past that. Null until an income is given.
   */
  readonly afford = computed(() => {
    const a = this.result().affordability;
    if (!a) return null;
    const share = t('{0}% of your income, {1}% with your debts', [decimal(a.housingPercent), decimal(a.totalPercent)]);
    if (a.comfortable.fits) return { answer: t('Yes'), good: true, note: t('{0}: within the comfortable 28% and 36%.', [share]) };
    if (a.mostAllowed.fits) return { answer: t('A stretch'), good: false, note: t('{0}: past the comfortable 28% and 36%, within what lenders allow.', [share]) };
    return { answer: t('Too much'), good: false, note: t('{0}: past what lenders allow.', [share]) };
  });

  /** Opens the form's income section with the cursor in the income field. */
  protected addIncome(): void {
    this.navigator.open('income', 'annual-income');
  }

  /**
   * On a loan already being paid, the payment due next: its housing costs have grown since the first payment, so the
   * tile shows it rather than the first. Null for a new loan.
   */
  readonly current = input<Payment | null>(null);

  /**
   * The extra principal in the first payment that has any (the next one, on a loan already being paid) and what that
   * payment comes to, or null when nothing extra is paid.
   */
  readonly withExtra = computed(() => {
    const first = this.result().accelerated.payments.find((p) => p.extraPrincipal > 0);
    return first ? { amount: first.extraPrincipal, total: first.totalOutlay } : null;
  });

  /**
   * The first payment due: principal and interest, and with housing costs. With a buydown it is year 1's reduced
   * payment, which is what the borrower actually pays at first.
   */
  readonly firstPayment = computed(() => {
    const r = this.result();
    const next = this.current();
    if (next) {
      const loan = next.scheduledPayment - next.buydownSubsidy;
      return { loan, total: loan + next.housingCosts, costs: next.costs };
    }
    const first = r.buydown?.years[0];
    const costs = r.baseline.monthlyHousingCosts;
    return first
      ? { loan: first.monthlyPayment, total: first.monthlyPayment + costs.total, costs }
      : { loan: r.baseline.monthlyPayment, total: r.baseline.totalMonthlyPayment, costs };
  });

  /**
   * Where a buydown's payment ends up, in the same terms as the tile (with that year's housing costs): "$3,160.61
   * from year 3". Every year in between is in the rate plan's table below. Empty without a buydown.
   */
  readonly fromNoteRate = computed(() => {
    const last = buydownYears(this.result())?.at(-1);
    return last ? `${usdCents(last.monthlyTotal)} ${last.label.toLowerCase()}` : '';
  });

  /** What the loan's mortgage insurance is called: MIP on an FHA loan, PMI otherwise. */
  readonly insuranceName = computed(() => mortgageInsuranceName(this.result().program));

  /**
   * What the first payment's housing costs are, in words: one or two by name ("property tax & insurance", or "MIP"
   * alone), and "housing costs" for more, so the line fits the tile; the breakdown below names every one. Only the
   * costs this loan has are named.
   */
  readonly housingCostsLabel = computed(() => {
    const c = this.firstPayment().costs;
    const taxes = TAXES.filter(([key]) => c[key] > 0).map(([, words]) => t(words));
    const parts = [
      ...(taxes.length > 1 ? [t('property taxes')] : taxes),
      ...(c.pidAssessment > 0 ? [t('PID')] : []),
      ...(c.homeownersInsurance > 0 ? [t('insurance')] : []),
      ...(c.mortgageInsurance > 0 ? [this.insuranceName()] : []),
      ...(c.hoaDues > 0 ? [t('HOA')] : []),
    ];
    if (parts.length > 2) return t('housing costs');
    return parts.length === 2 ? t('{0} & {1}', parts) : parts.join('');
  });

  /**
   * With a buydown, who pays the interest shown: a subsidy from the seller or builder pays part of it (the loan's own
   * interest does not change), while one bought at closing only lowers the early payments. Said of the schedule the
   * headline shows: with extra payments, the accelerated one.
   */
  readonly buydownNote = computed(() => {
    const r = this.result();
    if (!r.buydown) return null;
    if (r.buydown.paidBy === 'Borrower') return t('Your buydown, paid for at closing, lowers the early payments, not the interest.');
    const schedule = this.hasSavings() ? r.accelerated : r.baseline;
    return t("The seller's buydown pays {0} of it, so you pay {1}.", [usd(schedule.buydownSubsidy), usd(schedule.interestYouPay)]);
  });

  /** True when extra payments change anything; otherwise savings tiles would only show zeros. */
  readonly hasSavings = computed(() => {
    const s = this.result().savings;
    return s.netSavings !== 0 || s.paymentsSaved > 0 || s.totalExtraPrincipal > 0;
  });

  /** Payments saved, formatted as years and months. */
  readonly timeSaved = computed(() => formatMonths(this.result().savings.paymentsSaved));

  /** How much sooner extra payments end the mortgage insurance, e.g. "3 yr 2 mo", like the payoff tile's time saved. */
  readonly pmiSooner = computed(() => {
    const { baseline, accelerated } = this.result();
    const months = (iso: string | null | undefined) => (iso ? Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) : 0);
    return formatMonths(months(baseline.mortgageInsuranceEndDate) - months(accelerated.mortgageInsuranceEndDate));
  });

  /**
   * Where the net savings come from, e.g. "$79,801 interest + $6,531 PMI − $250 fees", or null when it is all
   * interest: the headline already says that number.
   */
  readonly savingsDetail = computed(() => {
    const s = this.result().savings;
    const parts = [t('{0} interest', [usd(s.interestSaved)])];
    if (s.mortgageInsuranceSaved > 0) parts.push(t('+ {0} {1}', [usd(s.mortgageInsuranceSaved), this.insuranceName()]));
    if (s.recastFees > 0) parts.push(t('− {0} fees', [usd(s.recastFees)]));
    return parts.length > 1 ? parts.join(' ') : null;
  });
}
