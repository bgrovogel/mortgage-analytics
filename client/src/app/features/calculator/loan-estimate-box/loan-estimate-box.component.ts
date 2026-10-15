import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TermComponent } from '../../../core/glossary/term.component';
import { decimal } from '../../../core/formatting/format';
import { AmortizationResponse } from '../../../core/models/amortization.models';

/**
 * A Loan Estimate's comparison box: the APR, what the first five years cost and pay off, and the interest over the
 * loan as a share of it. Lenders must show these in this form, so they are how real offers are compared.
 */
@Component({
  selector: 'app-loan-estimate-box',
  imports: [CurrencyPipe, TermComponent],
  template: `
    @let r = result();
    <h2>Comparing offers</h2>
    <p class="intro">The figures a lender's Loan Estimate lists to compare one loan with another.</p>
    <dl>
      @if (r.annualPercentageRate !== null && r.annualPercentageRate !== undefined) {
        <div>
          <dt data-testid="le-apr"><app-term of="APR">APR</app-term> {{ percent(r.annualPercentageRate) }}%</dt>
          <dd data-testid="le-apr-note">The yearly rate counting the lender’s fees as well as the interest, so offers with different fees compare fairly.</dd>
        </div>
      }
      @if (r.inFiveYears; as five) {
        <div>
          <dt data-testid="le-paid">In 5 years, you will have paid {{ five.totalPaid | currency }}</dt>
          <dd data-testid="le-paid-note">The first 60 payments of principal, interest, mortgage insurance and the lender’s loan costs, without extra payments.</dd>
          <dt data-testid="le-principal">and paid off {{ five.principalPaidOff | currency }} of the principal</dt>
        </div>
      }
      @if (r.totalInterestPercentage !== null && r.totalInterestPercentage !== undefined) {
        <div>
          <dt data-testid="le-tip">Total interest percentage {{ percent(r.totalInterestPercentage) }}%</dt>
          <dd data-testid="le-tip-note">The interest over the whole loan as a share of the amount borrowed: how much you pay for the loan for each dollar of it.</dd>
        </div>
      }
    </dl>
  `,
  styles: `
    :host {
      display: block;
    }

    h2 {
      margin: 0 0 0.25rem;
      font-size: 1.1rem;
    }

    .intro {
      margin: 0 0 1rem;
      color: var(--text-secondary);
    }

    dl {
      display: grid;
      gap: 1rem;
      margin: 0;
    }

    dt {
      font-weight: 600;
    }

    dd {
      margin: 0.15rem 0 0.5rem;
      color: var(--text-secondary);
      font-size: 0.92rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoanEstimateBoxComponent {
  /** The analysis whose figures are shown. */
  readonly result = input.required<AmortizationResponse>();

  /** A percentage to three places without trailing zeros: 127.543, 6.5. */
  protected readonly percent = (value: number) => decimal(value, 3);
}
