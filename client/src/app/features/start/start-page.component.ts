import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** One question a visitor may come with, and the page that answers it. */
interface Question {
  title: string;
  detail: string;
  link: string;
}

/** Ordered as a buyer meets them: what it costs, whether they can afford it, then the choices around it. */
const QUESTIONS: readonly Question[] = [
  { title: 'What will this home cost?', detail: 'Your monthly payment, the cash you need at closing, and when it is paid off.', link: '/calculator/overview' },
  { title: 'How much house can I afford?', detail: 'Start from your income and debts: the most you could pay for a home, and whether this one fits.', link: '/calculator/affordability' },
  { title: 'Should I rent or buy?', detail: 'How long you would need to stay for buying to come out ahead of renting.', link: '/calculator/rent-or-buy' },
  { title: 'Which home is better?', detail: 'Up to four homes, or one home from different lenders, side by side.', link: '/compare' },
  { title: 'Should I refinance?', detail: 'Your payment, your break-even and the total cost against the loan you have.', link: '/refinance' },
  { title: 'Pay off the mortgage, or invest?', detail: 'Three ways to use spare cash over 30 years, after tax and through a bad decade.', link: '/strategy' },
];

/**
 * The way in: a question first, not a form. Every card opens the page that answers it with example numbers to
 * replace, so a first visit never lands in a wall of fields.
 */
@Component({
  selector: 'app-start-page',
  imports: [RouterLink],
  template: `
    <section class="start" aria-labelledby="start-title">
      <header>
        <h2 id="start-title">What do you want to figure out?</h2>
        <p>Pick a question. You start with example numbers and replace them with yours; every answer updates as you type.</p>
      </header>
      <div class="questions" data-testid="start-questions">
        @for (question of questions; track question.link) {
          <a class="question" [routerLink]="question.link">
            <h3>{{ question.title }}</h3>
            <p>{{ question.detail }}</p>
          </a>
        }
      </div>
      <p class="promises" data-testid="start-promises">
        <span><strong>No account needed.</strong> Sign in only to save a calculation and find it again.</span>
        <span><strong>Nothing is saved unless you choose to save it.</strong></span>
      </p>
    </section>
  `,
  styleUrl: './start-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StartPageComponent {
  protected readonly questions = QUESTIONS;
}
