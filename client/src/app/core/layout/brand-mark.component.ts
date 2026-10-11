import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The brand mark: a roof over a balance curve falling to zero, the app's subject in one shape. Decorative (the name
 * beside it is the text), so it is hidden from assistive technology. Styled by `.mark` in styles.scss.
 */
@Component({
  selector: 'app-brand-mark',
  template: `
    <svg class="mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" class="mark-tile" />
      <path d="M7 15.5 16 8l9 7.5" class="mark-roof" />
      <path d="M9.5 18.5c3.2 0 5.6 1.4 7.6 3.6 1.4 1.5 2.9 2.4 5.4 2.4" class="mark-curve" />
    </svg>
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandMarkComponent {}
