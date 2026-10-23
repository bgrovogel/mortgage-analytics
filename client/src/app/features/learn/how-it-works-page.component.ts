import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RichTextComponent } from '../../shared/rich-text/rich-text.component';
import { ReadingNavComponent } from './reading-nav.component';
import { t } from '../../core/i18n/i18n';
import { TPipe } from '../../core/i18n/t.pipe';

/**
 * How each answer is worked out, in the order a buyer meets them, with the example loan ($415,000, 9% down, 6.25%,
 * 30 years) worked through where it helps. The rules are the ones in docs/06-mortgage-math.md, said for a buyer.
 */
@Component({
  selector: 'app-how-it-works-page',
  imports: [ReadingNavComponent, RichTextComponent, RouterLink, TPipe],
  template: `
    <section class="reading" aria-labelledby="how-title">
      <app-reading-nav />
      <header>
        <h1 id="how-title">{{ "How it's calculated" | t }}</h1>
        <p><app-rich [message]="'Every number comes from a formula or a rule you can read here, worked through with the example loan. Words you may not know are in the [link:/glossary]glossary[/link].' | t" /></p>
      </header>

      <nav class="contents" [attr.aria-label]="'On this page' | t" data-testid="contents">
        <span class="lead">{{ 'On this page' | t }}</span>
        @for (item of contents; track item.id) {
          <a [routerLink]="[]" [fragment]="item.id">{{ item.label }}</a>
        }
      </nav>

      <article>
        <section id="payment">
          <h3>{{ 'Your monthly payment' | t }}</h3>
          <p><app-rich [message]="'The principal-and-interest part is the same every month, chosen so the loan is exactly repaid on the last payment. With a loan of [b]P[/b], a monthly rate [b]i[/b] (the yearly rate divided by 12) and [b]n[/b] payments:' | t" /></p>
          <pre class="formula" tabindex="0">payment = P × i ÷ (1 − (1 + i)^−n)</pre>
          <p><app-rich [message]='"On the example, P is $377,650, i is 0.0052083 (6.25% ÷ 12) and n is 360, so the payment is [b]$2,325.26[/b]. Each month, interest is the balance times i, rounded to the cent; what is left of the payment pays principal. The first month&#39;s interest is $1,966.93, so $358.33 goes to principal." | t' /></p>
          <p>{{ "Your lender's figure may differ a little: taxes and insurance are estimates until you enter your own, and lenders round and count prepaid days in their own ways." | t }}</p>
        </section>

        <section id="taxes">
          <h3>{{ 'Taxes and insurance' | t }}</h3>
          <p><app-rich [message]='"Property tax is the rate times the taxable value: the home&#39;s value less any [term:Exemption]exemption[/term], and the value grows by the yearly increase you set (a [term:Homestead]homestead[/term]&#39;s can rise only so fast, held by the [term:Appraisal cap]appraisal cap[/term]). Homeowners insurance and [term:HOA]HOA[/term] dues are what you enter, rising at the rates you give them. They are collected with each payment into [term:Escrow]escrow[/term], so the first month&#39;s total is the loan&#39;s payment plus a twelfth of each." | t' /></p>
        </section>

        <section id="insurance">
          <h3>{{ 'Mortgage insurance' | t }}</h3>
          <p><app-rich [message]='"A conventional loan with less than 20% down carries [b][term:PMI]PMI[/term][/b]: its yearly rate on the amount borrowed, a twelfth each month. It ends when the balance reaches 80% of the home&#39;s value if you ask, or 78% of the original value on the original schedule, automatically. Extra payments bring the first date forward but not the second, and the app shows both." | t' /></p>
          <p><app-rich [message]='"An [b][term:FHA loan]FHA[/term][/b] loan has an upfront premium of 1.75% of the loan (added to it, unless you pay it at closing) and a yearly premium from HUD&#39;s table, which lasts 11 years with 10% or more down and otherwise the whole loan. A [b][term:VA loan]VA[/term][/b] loan has no mortgage insurance but a one-time funding fee, from 1.25% to 3.3% of the loan by down payment and prior use." | t' /></p>
        </section>

        <section id="closing">
          <h3>{{ 'Cash to close' | t }}</h3>
          <p>{{ "The down payment, plus the lender's costs and other fees, plus prepaid interest (a day's interest at the note rate, over a 365-day year, for the days from closing to month end), the first year's insurance and a few months of taxes and insurance into escrow, less credits. Credits can pay costs but never the down payment." | t }}</p>
          <p><app-rich [message]="'A seller or builder may pay only so much: for a conventional loan 3% of the price above 90% [term:Loan-to-value]loan-to-value[/term], 6% to 75% and 9% below (2% on an investment property); for FHA 6%; for VA 4%, besides the normal closing costs.' | t" /></p>
        </section>

        <section id="apr">
          <h3>{{ 'The APR' | t }}</h3>
          <p><app-rich [message]='"The rate at which the payments, each discounted by a month&#39;s interest, add up to what you actually received: the loan less the lender&#39;s costs, prepaid interest, discount points and an FHA or VA upfront fee, with each month&#39;s mortgage insurance in the payments. On the example it is [b]6.687%[/b] against a 6.25% rate: the fees alone make it 6.376%, and the PMI paid for the first six years or so adds the rest." | t' /></p>
        </section>

        <section id="afford">
          <h3>{{ 'What you can afford' | t }}</h3>
          <p><app-rich [message]='"Lenders measure your housing payment, and it with your other debts, as a share of gross monthly income. The comfortable limits are 28% and 36%; the most a conventional loan allows is 45% of income in all, FHA 31% and 43%, VA 41%. The highest price keeps your down payment&#39;s share, rate and costs and changes only the price, found by searching since taxes and insurance do not rise in a straight line. An adjustable rate is counted at the rate its program says, not its starting one. With a [term:Co-buyer]co-buyer[/term], a lender counts everyone&#39;s income and debts together, so the answer is for all of you; the first month&#39;s payment is then shared in proportion to income, and the down payment by what each puts in." | t' /></p>
        </section>

        <section id="rent">
          <h3>{{ 'Rent or buy' | t }}</h3>
          <p>{{ "Two households spend the same each month. Whichever of owning and renting costs less invests the difference, and the renter also invests what buying takes to close. The buyer is worth the home after selling (its value less what is owed and selling costs) plus investments; the renter, their investments. Buying breaks even in the first year from which it stays ahead. Tick the tax savings and the buyer's mortgage interest and property tax are weighed against the standard deduction a renter would take; what owning adds beyond it, at your tax rate, is invested as it is saved." | t }}</p>
        </section>

        <section id="sell">
          <h3>{{ 'If you sell' | t }}</h3>
          <p>{{ "For each year you might sell: the home's value then, less what you still owe, the costs of selling and the tax on any gain. The gain is the sale less its costs, over the price you paid. A home you live in shelters the first $250,000 of gain from tax ($500,000 for a couple filing jointly) once you have owned it two years; the rest is taxed at the rate you give. A second home or an investment property has no tax-free gain." | t }}</p>
        </section>

        <section id="rental">
          <h3>{{ 'As a rental' | t }}</h3>
          <p>{{ "If the home were let out: the rent, less the share lost to empty months, a manager, upkeep and the property taxes, insurance and dues of owning it, is what the property earns (its net operating income). The cap rate is that over the price; after the loan's payments it is the cash flow, and over the cash you put in, the cash-on-cash return. Lenders look for the rent to cover the payments 1.25 times." | t }}</p>
        </section>

        <section id="refinance">
          <h3>{{ 'Refinancing' | t }}</h3>
          <p>{{ "The new loan's payment and total interest against the loan you have, with closing costs included. The break-even is the payment by which the interest saved covers those costs. A new 30-year loan restarts the clock, so a lower payment can cost more overall; “keep paying today’s payment” shows what the same money does to the new loan." | t }}</p>
          <p><app-rich [message]="'With [term:Cash-out refinance]cash out[/term], the cash is borrowed on top of the balance and counted as money in hand. The other way to get it is to keep your loan and borrow the cash separately, as a [term:Home-equity loan]home-equity loan[/term] or a [term:HELOC]line of credit[/term], which is drawn in full at once and pays interest only for its [term:Draw period]draw period[/term], then is repaid at the rate you expect by then. Each way is costed over the years you keep it as what you pay in them, plus what you still owe after, plus what is paid at closing, so one that borrows for longer is not mistaken for a cheaper one. Points bought on the new loan are paid with the closing costs, and weighed on their own against the rate without them: the payment they save, and the payment by which the interest saved covers what they cost. A debt paid off with the cash out is weighed against keeping it the same way, over the years kept, so a lower payment that only spreads the debt over the new loan is not mistaken for a saving.' | t" /></p>
        </section>

        <section id="invest">
          <h3>{{ 'Pay off or invest' | t }}</h3>
          <p>{{ 'Spare cash each month goes to the mortgage, to investments, or in a mix, played out month by month for 30 years after tax. Paying down earns the mortgage rate for certain; investing earns more on average and not always. The page shows each in a good decade and a bad one, and ranks them on a return reduced for risk.' | t }}</p>
        </section>
      </article>

      <aside class="checked" data-testid="checked">
        <h3>{{ 'How we check it' | t }}</h3>
        <p>{{ "A separate model, written independently of the app's code, recomputes the numbers and is compared with the app on random purchases and refinances, to the cent. The rules are tested at their edges, and the tests themselves are tested by changing the code and seeing that they fail." | t }}</p>
      </aside>

      <aside class="sources" data-testid="sources">
        <h3>{{ 'Sources' | t }}</h3>
        <ul>
          <li>{{ 'Fannie Mae Selling Guide: B3-4.1-02 (what a seller may pay), B3-6-02 (debt-to-income), B3-6-04 (adjustable rates); Eligibility Matrix.' | t }}</li>
          <li>{{ 'HUD Handbook 4000.1 (FHA loans) and Mortgagee Letter 2023-05 (mortgage insurance).' | t }}</li>
          <li>{{ 'VA: 38 CFR 36.4340 and Pamphlet 26-7.' | t }}</li>
          <li>{{ 'Regulation Z (12 CFR 1026, Appendix J) for the APR.' | t }}</li>
          <li>{{ 'Texas Tax Code 11.13 for homestead exemptions.' | t }}</li>
          <li>{{ 'Internal Revenue Code section 121 for the home-sale exclusion.' | t }}</li>
          <li>{{ 'Each state’s own property tax rules, as its tax authority publishes them: California’s 1% and 2% cap, Florida’s Save Our Homes, Michigan’s inflation cap and Oklahoma’s 3% cap.' | t }}</li>
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
    { id: 'payment', get label() { return t('Your monthly payment'); } },
    { id: 'taxes', get label() { return t('Taxes and insurance'); } },
    { id: 'insurance', get label() { return t('Mortgage insurance'); } },
    { id: 'closing', get label() { return t('Cash to close'); } },
    { id: 'apr', get label() { return t('The APR'); } },
    { id: 'afford', get label() { return t('What you can afford'); } },
    { id: 'rent', get label() { return t('Rent or buy'); } },
    { id: 'sell', get label() { return t('If you sell'); } },
    { id: 'rental', get label() { return t('As a rental'); } },
    { id: 'refinance', get label() { return t('Refinancing'); } },
    { id: 'invest', get label() { return t('Pay off or invest'); } },
  ];
}
