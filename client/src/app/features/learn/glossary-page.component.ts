import { ChangeDetectionStrategy, Component } from '@angular/core';

/** A term the app uses, and what it means in a sentence or two. */
export interface GlossaryEntry {
  term: string;
  meaning: string;
}

/** In alphabetical order (a spec holds it there), so a reader can find a term without a search box. */
export const GLOSSARY: readonly GlossaryEntry[] = [
  { term: 'Amortization', meaning: 'Paying a loan off in equal installments. Early payments are mostly interest and later ones mostly principal, so the balance falls slowly at first.' },
  { term: 'APR', meaning: 'Annual percentage rate: the yearly cost of the loan counting its fees as well as its rate, so offers with different fees can be compared. It is higher than the rate whenever there are fees to count.' },
  { term: 'ARM', meaning: 'An adjustable-rate mortgage. The rate is fixed for the first years (a 5/1 ARM for five), then resets on a schedule, within caps on how far it can move at once and over the loan.' },
  { term: 'Buydown', meaning: 'Money paid up front to lower the payment: for the first years only (a temporary buydown such as 2-1), or for the whole loan (discount points).' },
  { term: 'Closing costs', meaning: 'What is paid on the day the loan is made besides the down payment: the lender’s fees, title and recording, prepaid interest, and the first deposits into escrow.' },
  { term: 'Debt-to-income', meaning: 'Your monthly debts, with the new housing payment, as a share of your gross monthly income. Lenders limit it: 28% and 36% is the classic comfortable measure, and a conventional loan may go to 45%.' },
  { term: 'Down payment', meaning: 'The part of the price you pay in cash. The loan is the price less the down payment.' },
  { term: 'Equity', meaning: 'What you own of the home: its value less what you still owe on it.' },
  { term: 'Escrow', meaning: 'An account the lender holds to pay your property tax and insurance. A twelfth of each year’s bill goes in with every payment.' },
  { term: 'FHA loan', meaning: 'A loan insured by the Federal Housing Administration, with as little as 3.5% down. It carries an upfront mortgage insurance premium and a yearly one.' },
  { term: 'HOA', meaning: 'A homeowners association, which charges dues for shared parts of a community. They count in your monthly housing cost.' },
  { term: 'Homestead', meaning: 'The home you live in as your principal residence. In Texas it earns exemptions from property tax and a cap on how fast its taxable value can rise.' },
  { term: 'Loan-to-value', meaning: 'The loan as a share of the home’s value. 90% means 10% down. Rules about PMI, loan limits and what a seller may pay all turn on it.' },
  { term: 'MIP', meaning: 'The mortgage insurance premium on an FHA loan: a fee at the start and a yearly charge. Unlike PMI it often lasts for the whole loan.' },
  { term: 'Note rate', meaning: 'The interest rate written on the loan. The APR is what it costs once fees are counted.' },
  { term: 'PMI', meaning: 'Private mortgage insurance on a conventional loan with less than 20% down. It protects the lender, and ends when you reach 80% of the home’s value (if you ask) or 78% (automatically).' },
  { term: 'Points', meaning: 'A fee paid at closing for a lower rate. One point is 1% of the loan.' },
  { term: 'Prepaid interest', meaning: 'The interest from the day you close to the end of that month, paid at closing because payments are made in arrears.' },
  { term: 'Principal', meaning: 'The part of the loan you still owe, apart from interest. Each payment pays some of it down.' },
  { term: 'Recast', meaning: 'Recalculating the payment after a large lump sum, so the same term has a smaller payment. Lenders charge a fee and ask for a minimum lump sum.' },
  { term: 'VA loan', meaning: 'A loan guaranteed by the Department of Veterans Affairs for eligible veterans and service members, with no down payment and no mortgage insurance, but a one-time funding fee.' },
];

/** A term's anchor: "Loan-to-value" is `term-loan-to-value`. */
const slug = (term: string) => `term-${term.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

/** The words the app uses, in plain language, each with an anchor so a link can land on it. */
@Component({
  selector: 'app-glossary-page',
  template: `
    <section class="reading" aria-labelledby="glossary-title">
      <header>
        <h2 id="glossary-title">Glossary</h2>
        <p>The words you will meet, in plain language.</p>
      </header>
      <dl class="terms" data-testid="glossary">
        @for (entry of entries; track entry.term) {
          <div class="term" [id]="anchor(entry.term)">
            <dt>{{ entry.term }}</dt>
            <dd>{{ entry.meaning }}</dd>
          </div>
        }
      </dl>
    </section>
  `,
  styleUrl: './reading-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlossaryPageComponent {
  protected readonly entries = GLOSSARY;
  protected readonly anchor = slug;
}
