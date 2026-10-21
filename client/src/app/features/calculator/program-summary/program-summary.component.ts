import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { pct, usd, usdCents } from '../../../core/formatting/format';
import { AmortizationResponse } from '../../../core/models/amortization.models';
import { t } from '../../../core/i18n/i18n';

/**
 * An FHA or VA loan in two sentences: the upfront fee (FHA's upfront MIP, VA's funding fee), whether it is borrowed
 * and so what is borrowed, then FHA's annual MIP and how long it lasts, or that a VA loan has no mortgage insurance.
 * Shows nothing for a conventional loan. It sits with the rate plan, so it shares that panel's styles.
 */
@Component({
  selector: 'app-program-summary',
  template: `
    @if (summary(); as s) {
      <section class="panel" data-testid="program-summary">
        <h3 data-testid="program-title">{{ s.title }}</h3>
        <p class="note" data-testid="program-note">{{ s.note }}</p>
      </section>
    }
  `,
  styleUrl: '../rate-plan/rate-plan.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgramSummaryComponent {
  /** The analysis, which has the program for an FHA or VA loan. */
  readonly result = input.required<AmortizationResponse>();

  /** The title and the explanation, or null for a conventional loan. */
  readonly summary = computed(() => {
    const result = this.result();
    const p = result.program;
    if (!p || p.type === 'Conventional') return null;

    const fha = p.type === 'Fha';
    const borrowed = usdCents(p.loanAmount);
    const fee = [pct(p.upfrontFeePercent), usdCents(p.upfrontFee), borrowed];
    const upfront = p.upfrontFee === 0
      ? (fha ? t('No upfront MIP (exempt), so you borrow {0}.', [borrowed]) : t('No funding fee (exempt), so you borrow {0}.', [borrowed]))
      : fha
        ? (p.upfrontFeeFinanced ? t('The {0} upfront MIP, {1}, is added to the loan, so you borrow {2}.', fee) : t('The {0} upfront MIP, {1}, is paid at closing, so you borrow {2}.', fee))
        : (p.upfrontFeeFinanced ? t('The {0} funding fee, {1}, is added to the loan, so you borrow {2}.', fee) : t('The {0} funding fee, {1}, is paid at closing, so you borrow {2}.', fee));
    if (!fha) return { title: t('VA loan'), note: `${upfront} ${t('There is no mortgage insurance, whatever the down payment.')}` };

    const annual = [p.annualMipPercent.toFixed(2), usdCents(result.baseline.monthlyHousingCosts.mortgageInsurance)];
    const mip = p.mipPayments === 132
      ? t('The annual MIP is {0}% of the balance, {1} a month in year 1, for 11 years.', annual)
      : t('The annual MIP is {0}% of the balance, {1} a month in year 1, for the whole loan: with 10% or more down it would end after 11 years.', annual);
    const county = p.countyName && p.countyLoanLimit ? t("FHA's {0} limit in {1} is {2}.", [p.loanLimitYear, p.countyName, usd(p.countyLoanLimit)]) : '';
    return { title: t('FHA loan'), note: [upfront, mip, county].filter(Boolean).join(' ') };
  });
}
