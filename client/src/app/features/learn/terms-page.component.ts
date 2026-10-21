import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReadingNavComponent } from './reading-nav.component';
import { TPipe } from '../../core/i18n/t.pipe';

/**
 * What the app is and is not, in plain words: an estimator, not a lender, an adviser or a promise. It says only what is
 * true of this project (a demonstration, rules for one tax year, answers that can differ from a lender's).
 */
@Component({
  selector: 'app-terms-page',
  imports: [ReadingNavComponent, RouterLink, TPipe],
  template: `
    <section class="reading" aria-labelledby="terms-title">
      <app-reading-nav />
      <header>
        <h1 id="terms-title">{{ 'Terms' | t }}</h1>
        <p>{{ 'What these numbers are, and what they are not. How each one is worked out is in' | t }}
          <a routerLink="/how-it-works">{{ "How it's calculated" | t }}</a>.</p>
      </header>

      <article>
        <section id="what">
          <h3>{{ 'What this is' | t }}</h3>
          <p>{{ 'Mortgage Analytics works out an' | t }} <strong>{{ 'estimate' | t }}</strong> {{ 'from the figures you type and the rules it knows: what a home may cost each month, what you could borrow, what a refinance or an extra payment may save. It is not a loan offer, a quote, a Loan Estimate or a pre-approval, and no lender has seen your numbers.' | t }}</p>
        </section>

        <section id="advice">
          <h3>{{ 'What it is not' | t }}</h3>
          <p>{{ 'It is not financial, tax or legal advice, and it does not know your whole situation. Before you sign or pay anything, ask a lender for a Loan Estimate, and ask a tax professional or an attorney about taxes, homestead exemptions and anything else that depends on where you live and how you file.' | t }}</p>
        </section>

        <section id="exact">
          <h3>{{ 'How exact it is' | t }}</h3>
          <p>{{ "The arithmetic is exact to the cent, and an independent model written separately from the app's code is checked against it. But an estimate can still be off: your lender rounds, counts prepaid days and charges fees in its own ways, and a county sets your tax bill, not a rate you typed. The rules (loan limits, deductions, exemptions, retirement limits) are for the tax year" | t }} <strong>2026</strong> {{ 'and change from year to year; where they cannot be known, such as future home values or market returns, the answer is only as good as what you assume.' | t }}</p>
        </section>

        <section id="promises">
          <h3>{{ 'No promises' | t }}</h3>
          <p>{{ 'This is a demonstration project, provided as it is, without any warranty that it is right, complete or fit for a particular decision. You are responsible for what you decide, and the people who made it are not liable for it.' | t }}</p>
        </section>

        <section id="privacy">
          <h3>{{ 'Your numbers and your account' | t }}</h3>
          <p>{{ 'What happens to what you type, and to an account if you make one, is on the' | t }}
            <a routerLink="/privacy">{{ 'Privacy' | t }}</a> {{ 'page.' | t }}</p>
        </section>
      </article>
    </section>
  `,
  styleUrl: './reading-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermsPageComponent {}
