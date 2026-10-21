import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TermComponent } from '../../core/glossary/term.component';
import { ReadingNavComponent } from './reading-nav.component';

/**
 * How each answer is worked out, in the order a buyer meets them, with the example loan ($415,000, 9% down, 6.25%,
 * 30 years) worked through where it helps. The rules are the ones in docs/06-mortgage-math.md, said for a buyer.
 */
@Component({
  selector: 'app-how-it-works-page',
  imports: [ReadingNavComponent, RouterLink, TermComponent],
  template: `
    <section class="reading" aria-labelledby="how-title">
      <app-reading-nav />
      <header>
        <h1 id="how-title">How it's calculated</h1>
        <p>Every number comes from a formula or a rule you can read here, worked through with the example loan. Words you
          may not know are in the <a routerLink="/glossary">glossary</a>.</p>
      </header>

      <nav class="contents" aria-label="On this page" data-testid="contents">
        <span class="lead">On this page</span>
        @for (item of contents; track item.id) {
          <a [routerLink]="[]" [fragment]="item.id">{{ item.label }}</a>
        }
      </nav>

      <article>
        <section id="payment">
          <h3>Your monthly payment</h3>
          <p>The principal-and-interest part is the same every month, chosen so the loan is exactly repaid on the last
            payment. With a loan of <strong>P</strong>, a monthly rate <strong>i</strong> (the yearly rate divided by 12)
            and <strong>n</strong> payments:</p>
          <pre class="formula" tabindex="0">payment = P × i ÷ (1 − (1 + i)^−n)</pre>
          <p>On the example, P is $377,650, i is 0.0052083 (6.25% ÷ 12) and n is 360, so the payment is
            <strong>$2,325.26</strong>. Each month, interest is the balance times i, rounded to the cent; what is left of
            the payment pays principal. The first month's interest is $1,966.93, so $358.33 goes to principal.</p>
          <p>Your lender's figure may differ a little: taxes and insurance are estimates until you enter your own, and
            lenders round and count prepaid days in their own ways.</p>
        </section>

        <section id="taxes">
          <h3>Taxes and insurance</h3>
          <p>Property tax is the rate times the taxable value: the home's value less any <app-term of="Exemption">exemption</app-term>,
            and the value grows by the yearly increase you set (a <app-term of="Homestead">homestead</app-term>'s can rise only so
            fast, held by the <app-term of="Appraisal cap">appraisal cap</app-term>). Homeowners insurance and
            <app-term of="HOA">HOA</app-term> dues are what you enter,
            rising at the rates you give them. They are collected with each payment into <app-term of="Escrow">escrow</app-term>, so the first month's
            total is the loan's payment plus a twelfth of each.</p>
        </section>

        <section id="insurance">
          <h3>Mortgage insurance</h3>
          <p>A conventional loan with less than 20% down carries <strong><app-term of="PMI">PMI</app-term></strong>: its yearly rate on the amount
            borrowed, a twelfth each month. It ends when the balance reaches 80% of the home's value if you ask, or 78% of
            the original value on the original schedule, automatically. Extra payments bring the first date forward but not
            the second, and the app shows both.</p>
          <p>An <strong><app-term of="FHA loan">FHA</app-term></strong> loan has an upfront premium of 1.75% of the loan (added to it, unless you pay it at
            closing) and a yearly premium from HUD's table, which lasts 11 years with 10% or more down and otherwise the
            whole loan. A <strong><app-term of="VA loan">VA</app-term></strong> loan has no mortgage insurance but a one-time funding fee, from 1.25% to 3.3%
            of the loan by down payment and prior use.</p>
        </section>

        <section id="closing">
          <h3>Cash to close</h3>
          <p>The down payment, plus the lender's costs and other fees, plus prepaid interest (a day's interest at the note
            rate, over a 365-day year, for the days from closing to month end), the first year's insurance and a few months
            of taxes and insurance into escrow, less credits. Credits can pay costs but never the down payment.</p>
          <p>A seller or builder may pay only so much: for a conventional loan 3% of the price above 90% <app-term of="Loan-to-value">loan-to-value</app-term>, 6%
            to 75% and 9% below (2% on an investment property); for FHA 6%; for VA 4%, besides the normal closing costs.</p>
        </section>

        <section id="apr">
          <h3>The APR</h3>
          <p>The rate at which the payments, each discounted by a month's interest, add up to what you actually received:
            the loan less the lender's costs, prepaid interest, discount points and an FHA or VA upfront fee, with each
            month's mortgage insurance in the payments. On the example it is <strong>6.687%</strong> against a 6.25% rate: the
            fees alone make it 6.376%, and the PMI paid for the first six years or so adds the rest.</p>
        </section>

        <section id="afford">
          <h3>What you can afford</h3>
          <p>Lenders measure your housing payment, and it with your other debts, as a share of gross monthly income. The
            comfortable limits are 28% and 36%; the most a conventional loan allows is 45% of income in all, FHA 31% and 43%,
            VA 41%. The highest price keeps your down payment's share, rate and costs and changes only the price, found by
            searching since taxes and insurance do not rise in a straight line. An adjustable rate is counted at the rate
            its program says, not its starting one. With a <app-term of="Co-buyer">co-buyer</app-term>, a lender counts everyone's
            income and debts together, so the answer is for all of you; the first month's payment is then shared in proportion
            to income, and the down payment by what each puts in.</p>
        </section>

        <section id="rent">
          <h3>Rent or buy</h3>
          <p>Two households spend the same each month. Whichever of owning and renting costs less invests the difference,
            and the renter also invests what buying takes to close. The buyer is worth the home after selling (its value
            less what is owed and selling costs) plus investments; the renter, their investments. Buying breaks even in the
            first year from which it stays ahead.</p>
        </section>

        <section id="refinance">
          <h3>Refinancing</h3>
          <p>The new loan's payment and total interest against the loan you have, with closing costs included. The break-even
            is the payment by which the interest saved covers those costs. A new 30-year loan restarts the clock, so a lower
            payment can cost more overall; "keep paying today's payment" shows what the same money does to the new loan.</p>
        </section>

        <section id="invest">
          <h3>Pay off or invest</h3>
          <p>Spare cash each month goes to the mortgage, to investments, or in a mix, played out month by month for 30
            years after tax. Paying down earns the mortgage rate for certain; investing earns more on average and not
            always. The page shows each in a good decade and a bad one, and ranks them on a return reduced for risk.</p>
        </section>
      </article>

      <aside class="checked" data-testid="checked">
        <h3>How we check it</h3>
        <p>A separate model, written independently of the app's code, recomputes the numbers and is compared with the app on
          random purchases and refinances, to the cent. The rules are tested at their edges, and the tests themselves are
          tested by changing the code and seeing that they fail.</p>
      </aside>

      <aside class="sources" data-testid="sources">
        <h3>Sources</h3>
        <ul>
          <li>Fannie Mae Selling Guide: B3-4.1-02 (what a seller may pay), B3-6-02 (debt-to-income), B3-6-04 (adjustable rates); Eligibility Matrix.</li>
          <li>HUD Handbook 4000.1 (FHA loans) and Mortgagee Letter 2023-05 (mortgage insurance).</li>
          <li>VA: 38 CFR 36.4340 and Pamphlet 26-7.</li>
          <li>Regulation Z (12 CFR 1026, Appendix J) for the APR.</li>
          <li>Texas Tax Code 11.13 for homestead exemptions.</li>
        </ul>
      </aside>
    </section>
  `,
  styleUrl: './reading-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HowItWorksPageComponent {
  /** The sections, in the order they are written, for the contents at the top. */
  protected readonly contents = [
    { id: 'payment', label: 'Your monthly payment' },
    { id: 'taxes', label: 'Taxes and insurance' },
    { id: 'insurance', label: 'Mortgage insurance' },
    { id: 'closing', label: 'Cash to close' },
    { id: 'apr', label: 'The APR' },
    { id: 'afford', label: 'What you can afford' },
    { id: 'rent', label: 'Rent or buy' },
    { id: 'refinance', label: 'Refinancing' },
    { id: 'invest', label: 'Pay off or invest' },
  ];
}
