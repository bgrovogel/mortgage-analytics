import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TermComponent } from '../../../core/glossary/term.component';
import { decimal } from '../../../core/formatting/format';
import { AmortizationResponse } from '../../../core/models/amortization.models';
import { TPipe } from '../../../core/i18n/t.pipe';

/**
 * A Loan Estimate's comparison box: the APR, what the first five years cost and pay off, and the interest over the
 * loan as a share of it. Lenders must show these in this form, so they are how real offers are compared.
 */
@Component({
  selector: 'app-loan-estimate-box',
  imports: [CurrencyPipe, TermComponent, TPipe],
  template: `
    @let r = result();
    <p class="intro">{{ "The figures a lender's Loan Estimate lists to compare one loan with another." | t }}</p>
    <dl>
      @if (r.annualPercentageRate !== null && r.annualPercentageRate !== undefined) {
        <div>
          <dt data-testid="le-apr"><span class="label"><app-term of="APR">{{ 'APR' | t }}</app-term></span>{{ '&ngsp;' | t }}<span class="value">{{ percent(r.annualPercentageRate) }}%</span></dt>
          <dd data-testid="le-apr-note">{{ 'The yearly rate counting the lender’s fees as well as the interest, so offers with different fees compare fairly.' | t }}</dd>
        </div>
      }
      @if (r.inFiveYears; as five) {
        <div>
          <dt data-testid="le-paid"><span class="label">{{ 'In 5 years, you will have paid' | t }}</span>{{ '&ngsp;' | t }}<span class="value">{{ five.totalPaid | currency }}</span></dt>
          <dd data-testid="le-paid-note">{{ 'The first 60 payments of principal, interest, mortgage insurance and the lender’s loan costs, without extra payments.' | t }}</dd>
          <dt data-testid="le-principal"><span class="label">{{ 'and paid off' | t }}</span>{{ '&ngsp;' | t }}<span class="value">{{ five.principalPaidOff | currency }}</span>{{ '&ngsp;' | t }}<span class="label">{{ 'of the principal' | t }}</span></dt>
        </div>
      }
      @if (r.totalInterestPercentage !== null && r.totalInterestPercentage !== undefined) {
        <div>
          <dt data-testid="le-tip"><span class="label">{{ 'Total interest percentage' | t }}</span>{{ '&ngsp;' | t }}<span class="value">{{ percent(r.totalInterestPercentage) }}%</span></dt>
          <dd data-testid="le-tip-note">{{ 'The interest over the whole loan as a share of the amount borrowed: how much you pay for the loan for each dollar of it.' | t }}</dd>
        </div>
      }
    </dl>
  `,
  styles: `
    :host {
      display: block;
    }

    .intro {
      margin: 0 0 1rem;
      color: var(--text-secondary);
    }

    // One tile for each figure the estimate lists, the figure large and what it is above it.
    dl {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
      gap: 0.75rem;
      margin: 0;
    }

    dl > div {
      padding: 0.9rem 1rem;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--surface-2);
    }

    .label {
      display: block;
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--text-secondary);
    }

    .value {
      display: block;
      margin: 0.1rem 0 0.2rem;
      font-size: 1.5rem;
      font-weight: 650;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.01em;
      color: var(--text-primary);
    }

    dt + dd + dt {
      margin-top: 0.6rem;
    }

    dd {
      margin: 0.15rem 0 0;
      color: var(--text-secondary);
      font-size: 0.85rem;
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
