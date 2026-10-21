import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LANGUAGES, Language, chooseLanguage, currentLanguage } from './i18n';
import { TPipe } from './t.pipe';

/**
 * The language switch: one tap in the header of every page, whichever page that is, in the names the languages call
 * themselves ("English", "Español"). The page changes at once, with what was typed still there; the choice is remembered.
 * On a phone it shortens to EN and ES, each still named in full for a screen reader.
 */
@Component({
  selector: 'app-language-switch',
  imports: [TPipe],
  template: `
    <div class="language" role="group" [attr.aria-label]="'Language' | t">
      @for (language of languages; track language.code) {
        <button type="button" [attr.lang]="language.code" [attr.aria-pressed]="current() === language.code"
                [attr.aria-label]="language.name" [attr.data-testid]="'language-' + language.code" (click)="choose(language.code)">
          <span class="full" aria-hidden="true">{{ language.name }}</span>
          <span class="short" aria-hidden="true">{{ language.short }}</span>
        </button>
      }
    </div>
  `,
  styles: `
    .language {
      display: inline-flex;
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
    }

    button {
      font: inherit;
      font-size: 0.85rem;
      min-height: 32px;
      padding: 0 0.7rem;
      border: 0;
      background: var(--surface-1);
      color: var(--text-secondary);
      cursor: pointer;

      & + button {
        border-left: 1px solid var(--border);
      }

      &[aria-pressed='true'] {
        background: var(--accent-soft);
        color: var(--accent-text);
        font-weight: 600;
      }

      &:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: -2px;
      }
    }

    .short {
      display: none;
    }

    @media (max-width: 640px) {
      .full {
        display: none;
      }

      .short {
        display: inline;
      }

      // Narrow enough that the app's name, this and Sign in all fit on one line down to a 360px screen.
      button {
        min-width: 30px;
        padding: 0 0.3rem;
        font-size: 0.78rem;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageSwitchComponent {
  protected readonly languages = LANGUAGES;
  protected readonly current = currentLanguage;

  protected choose(code: Language): void {
    void chooseLanguage(code);
  }
}
