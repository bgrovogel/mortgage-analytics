import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TPipe } from '../../core/i18n/t.pipe';
import { t } from '../../core/i18n/i18n';

/** One question a visitor may come with, and the page that answers it. */
interface Question {
  title: string;
  detail: string;
  /** What the question comes to on the example numbers (the same figures the end-to-end tests pin). */
  example: string;
  link: string;
}

/** Ordered as a buyer meets them: what it costs, whether they can afford it, then the choices around it. */
const QUESTIONS: readonly Question[] = [
  { get title() { return t('What will this home cost?'); }, get detail() { return t('Your monthly payment, the cash you need at closing, and when it is paid off.'); }, get example() { return t('$3,102 a month'); }, link: '/calculator/overview' },
  { get title() { return t('How much house can I afford?'); }, get detail() { return t('Start from your income and debts: the most you could pay for a home, and whether this one fits.'); }, get example() { return t('up to $474,091 comfortably, on $150,000 of income'); }, link: '/calculator/affordability' },
  { get title() { return t('Should I rent or buy?'); }, get detail() { return t('How long you would need to stay for buying to come out ahead of renting.'); }, get example() { return t('buying wins after 4 years, against $2,700 rent'); }, link: '/calculator/rent-or-buy' },
  { get title() { return t('Which home is better?'); }, get detail() { return t('Up to four homes, or one home from different lenders, side by side.'); }, get example() { return t('the same home from two lenders, side by side'); }, link: '/compare' },
  { get title() { return t('Should I refinance?'); }, get detail() { return t('Your payment, your break-even and the total cost against the loan you have.'); }, get example() { return t('saves $14,067 and breaks even in Jul 2029'); }, link: '/refinance' },
  { get title() { return t('Pay off the mortgage, or invest?'); }, get detail() { return t('Three ways to use spare cash over 30 years, after tax and through a bad decade.'); }, get example() { return t('investing is $134,597 ahead at 8%'); }, link: '/strategy' },
];

/**
 * The way in: a question first, not a form. Every card opens the page that answers it with example numbers to
 * replace, so a first visit never lands in a wall of fields.
 */
@Component({
  selector: 'app-start-page',
  imports: [RouterLink, TPipe],
  template: `
    <section class="start" aria-labelledby="start-title">
      @if (notFound) {
        <p class="not-found" role="status" data-testid="not-found">
          {{ 'That address is not a page here. These are the questions the app answers.' | t }}
        </p>
      }
      <header>
        <h1 id="start-title">{{ 'What do you want to figure out?' | t }}</h1>
        <p>{{ 'Pick a question. You start with example numbers and replace them with yours; every answer updates as you type.' | t }}</p>
      </header>
      <div class="questions" data-testid="start-questions">
        @for (question of questions; track question.link) {
          <a class="question" [routerLink]="question.link">
            <h3>{{ question.title }}</h3>
            <p>{{ question.detail }}</p>
            <p class="example">{{ 'With the example: {0}' | t: [question.example] }}</p>
          </a>
        }
      </div>
      <p class="promises" data-testid="start-promises">
        <span><strong>{{ 'No account needed.' | t }}</strong> {{ 'Sign in only to save a calculation and find it again.' | t }}</span>
        <span><strong>{{ 'Nothing is saved unless you choose to save it.' | t }}</strong></span>
      </p>
    </section>
  `,
  styleUrl: './start-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StartPageComponent {
  protected readonly questions = QUESTIONS;

  /** True when this is where an address that is not a page leads (the route says so), so the page can say it. */
  protected readonly notFound = inject(ActivatedRoute).snapshot.data['notFound'] === true;
}
