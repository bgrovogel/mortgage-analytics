import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { pct, usd, usdCents } from '../../../core/formatting/format';
import { AmortizationResponse } from '../../../core/models/amortization.models';

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
    const fee = fha ? 'upfront MIP' : 'funding fee';
    const borrow = `so you borrow ${usdCents(p.loanAmount)}.`;
    const upfront = p.upfrontFee === 0
      ? `No ${fee} (exempt), ${borrow}`
      : `The ${pct(p.upfrontFeePercent)} ${fee}, ${usdCents(p.upfrontFee)}, is ${p.upfrontFeeFinanced ? 'added to the loan' : 'paid at closing'}, ${borrow}`;
    if (!fha) return { title: 'VA loan', note: `${upfront} There is no mortgage insurance, whatever the down payment.` };

    const forWhole = p.mipPayments === 132
      ? 'for 11 years.'
      : 'for the whole loan: with 10% or more down it would end after 11 years.';
    const monthly = usdCents(result.baseline.monthlyHousingCosts.mortgageInsurance);
    const county = p.countyName && p.countyLoanLimit ? ` FHA's ${p.loanLimitYear} limit in ${p.countyName} is ${usd(p.countyLoanLimit)}.` : '';
    return {
      title: 'FHA loan',
      note: `${upfront} The annual MIP is ${p.annualMipPercent.toFixed(2)}% of the balance, ${monthly} a month in year 1, ${forWhole}${county}`,
    };
  });
}
