import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { THEME_CHOICES, ThemeChoice, applyTheme, loadTheme, saveTheme } from './theme';
import { TPipe } from '../i18n/t.pipe';

/**
 * Light, dark or the system's colours, chosen once and remembered: a few people want the page in a theme that is not
 * their system's. The app applies the remembered choice when it starts; this changes it.
 */
@Component({
  imports: [TPipe],
  selector: 'app-theme-switch',
  template: `
    <div class="theme" role="group" [attr.aria-label]="'Color theme' | t">
      @for (choice of choices; track choice.value) {
        <button type="button" [attr.aria-pressed]="current() === choice.value" [attr.data-testid]="'theme-' + choice.value"
                (click)="choose(choice.value)">{{ choice.label }}</button>
      }
    </div>
  `,
  styles: `
    .theme {
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
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeSwitchComponent {
  protected readonly choices = THEME_CHOICES;
  protected readonly current = signal<ThemeChoice>(loadTheme());

  protected choose(choice: ThemeChoice): void {
    this.current.set(choice);
    saveTheme(choice);
    applyTheme(window, choice);
  }
}
