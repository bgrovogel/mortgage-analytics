import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TPipe } from '../../../core/i18n/t.pipe';

/** Where it is remembered, per browser, that the hints were dismissed. */
export const HINTS_STORAGE_KEY = 'first-visit-hints';

function dismissedBefore(): boolean {
  try {
    return localStorage.getItem(HINTS_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Three short hints for a first visit, dismissed for good: where the numbers go, where the answer is, and what the
 * views are. A banner above the page, not a tour that takes the page over.
 */
@Component({
  imports: [TPipe],
  selector: 'app-first-visit-hints',
  template: `
    @if (!dismissed()) {
      <section class="hints" [attr.aria-label]="'How this page works' | t" data-testid="first-visit">
        <ol>
          <li><strong>{{ 'Your numbers' | t }}</strong> {{ 'are on the left, starting from an example: type your own and everything follows.' | t }}</li>
          <li><strong>{{ 'The answer' | t }}</strong> {{ 'is at the top, in a line, with what is behind it under it.' | t }}</li>
          <li><strong>{{ 'The views' | t }}</strong> {{ 'answer the next question: can you afford it, rent or buy, compare. Closing costs and every payment are under Cost.' | t }}</li>
        </ol>
        <button type="button" data-testid="dismiss-hints" (click)="dismiss()">{{ 'Got it' | t }}</button>
      </section>
    }
  `,
  styles: `
    .hints {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem 1.5rem;
      margin: 0 0 1rem;
      padding: 0.75rem 1rem;
      border-radius: var(--radius-md);
      background: var(--accent-soft);
      color: var(--text-primary);
      font-size: 0.9rem;
    }

    ol {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem 1.5rem;
      margin: 0;
      padding-left: 1.2rem;
      flex: 1 1 28rem;
    }

    li {
      flex: 1 1 14rem;
    }

    button {
      min-height: 36px;
      padding: 0 1rem;
      border: 1px solid var(--accent);
      border-radius: var(--radius-sm);
      background: var(--surface-1);
      color: var(--accent-text);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FirstVisitHintsComponent {
  protected readonly dismissed = signal(dismissedBefore());

  protected dismiss(): void {
    this.dismissed.set(true);
    try {
      localStorage.setItem(HINTS_STORAGE_KEY, '1');
    } catch {
      // Gone for this visit; the next one shows it again.
    }
  }
}
