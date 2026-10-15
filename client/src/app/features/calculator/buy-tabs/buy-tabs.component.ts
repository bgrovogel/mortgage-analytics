import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/**
 * The views of buying a home, each its own URL so it can be bookmarked, shared and reached with the back button.
 * Compare is the last: a page of its own that takes the calculator's loan as Home A, so the calculator and Compare
 * show the same row.
 */
export const BUY_TABS = [
  { id: 'overview', link: '/calculator/overview', label: 'Overview' },
  { id: 'affordability', link: '/calculator/affordability', label: 'Affordability' },
  { id: 'closing', link: '/calculator/closing', label: 'Closing' },
  { id: 'rent-or-buy', link: '/calculator/rent-or-buy', label: 'Rent or buy' },
  { id: 'projection', link: '/calculator/projection', label: 'Projection' },
  { id: 'schedule', link: '/calculator/schedule', label: 'Schedule' },
  { id: 'compare', link: '/compare', label: 'Compare' },
] as const;

/** The row of views, shared by the calculator and Compare so a buyer never loses the way between them. */
@Component({
  selector: 'app-buy-tabs',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="result-tabs" aria-label="Results">
      @for (tab of tabs; track tab.id) {
        <a [routerLink]="tab.link" routerLinkActive="active" ariaCurrentWhenActive="page" [attr.data-testid]="'result-tab-' + tab.id">{{ tab.label }}</a>
      }
    </nav>
  `,
  styleUrl: './buy-tabs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuyTabsComponent {
  protected readonly tabs = BUY_TABS;
}
