import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** The four pages that explain the app, as one row, so a reader moves between them without going back. */
@Component({
  selector: 'app-reading-nav',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav aria-label="Pages that explain it" class="reading-nav">
      <a routerLink="/how-it-works" routerLinkActive="active" ariaCurrentWhenActive="page">How it’s calculated</a>
      <a routerLink="/glossary" routerLinkActive="active" ariaCurrentWhenActive="page">Glossary</a>
      <a routerLink="/privacy" routerLinkActive="active" ariaCurrentWhenActive="page">Privacy</a>
      <a routerLink="/terms" routerLinkActive="active" ariaCurrentWhenActive="page">Terms</a>
    </nav>
  `,
  styles: `
    .reading-nav {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
      border-bottom: 1px solid var(--border);
    }

    a {
      padding: 0.55rem 0.9rem;
      margin-bottom: -1px;
      border-bottom: 2px solid transparent;
      color: var(--text-secondary);
      text-decoration: none;

      &:hover {
        color: var(--text-primary);
      }

      &.active {
        color: var(--accent-text);
        border-bottom-color: var(--accent);
        font-weight: 600;
      }

      &:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: -2px;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReadingNavComponent {}
