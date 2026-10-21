import { ChangeDetectionStrategy, Component, Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { TPipe } from '../../../core/i18n/t.pipe';
import { t } from '../../../core/i18n/i18n';

/**
 * The views of buying a home, each its own URL so it can be bookmarked, shared and reached with the back button.
 * Four questions sit in the row: what it costs, whether you can afford it, rent or buy, and Compare (a page of its own
 * that takes the calculator's loan as Home A). The views under Cost, the closing costs, the years, what a sale would leave, letting it out and every
 * payment, are one step down: a second row shown with Cost, so the first row stays four questions, not seven tabs.
 */
export const BUY_VIEWS = [
  { id: 'overview', link: '/calculator/overview', get label() { return t('Cost'); } },
  { id: 'affordability', link: '/calculator/affordability', get label() { return t('Can I afford it?'); } },
  { id: 'rent-or-buy', link: '/calculator/rent-or-buy', get label() { return t('Rent or buy?'); } },
  { id: 'compare', link: '/compare', get label() { return t('Compare'); } },
] as const;

/** Under Cost, in the order a buyer goes deeper. */
export const BUY_DEPTH = [
  { id: 'closing', link: '/calculator/closing', get label() { return t('Closing costs'); } },
  { id: 'projection', link: '/calculator/projection', get label() { return t('Year by year'); } },
  { id: 'sale', link: '/calculator/sale', get label() { return t('If you sell'); } },
  { id: 'rental', link: '/calculator/rental', get label() { return t('As a rental'); } },
  { id: 'schedule', link: '/calculator/schedule', get label() { return t('Every payment'); } },
] as const;

/** Every view's id, in the order a buyer meets them. */
export const BUY_TABS = [BUY_VIEWS[0], BUY_VIEWS[1], BUY_DEPTH[0], BUY_VIEWS[2], BUY_DEPTH[1], BUY_DEPTH[2], BUY_DEPTH[3], BUY_DEPTH[4], BUY_VIEWS[3]] as const;

/** The id of the view an address shows: `/calculator/closing` is "closing", `/compare` is "compare". */
export function buyViewOf(url: string): string {
  const path = url.split(/[?#]/)[0];
  return path === '/compare' ? 'compare' : (path.split('/')[2] ?? 'overview');
}

/** The id of the view open, as a signal that follows navigation. Call from an injection context. */
export function currentBuyView(): Signal<string> {
  const router = inject(Router);
  const url = toSignal(router.events.pipe(filter((event) => event instanceof NavigationEnd), map(() => router.url)), { initialValue: router.url });
  return computed(() => buyViewOf(url()));
}

/** The rows of views, shared by the calculator and Compare so a buyer never loses the way between them. */
@Component({
  selector: 'app-buy-tabs',
  imports: [RouterLink, TPipe],
  template: `
    <nav class="result-tabs" [attr.aria-label]="'Results' | t">
      @for (view of views; track view.id) {
        <a [routerLink]="view.link" [class.active]="isOpen(view.id)" [attr.aria-current]="view.id === current() ? 'page' : null"
           [attr.data-testid]="'result-tab-' + view.id">{{ view.label }}</a>
      }
    </nav>
    @if (showDepth()) {
      <nav class="depth" [attr.aria-label]="'Go deeper' | t" data-testid="depth-views">
        @if (current() === 'overview') {
          <span class="lead">{{ 'Go deeper' | t }}</span>
        } @else {
          <a class="back" routerLink="/calculator/overview" data-testid="back-to-cost">{{ '← Back to Cost' | t }}</a>
        }
        @for (view of depth; track view.id) {
          <a [routerLink]="view.link" [class.active]="view.id === current()" [attr.aria-current]="view.id === current() ? 'page' : null"
             [attr.data-testid]="'result-tab-' + view.id">{{ view.label }}</a>
        }
      </nav>
    }
  `,
  styleUrl: './buy-tabs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuyTabsComponent {
  protected readonly views = BUY_VIEWS;
  protected readonly depth = BUY_DEPTH;

  protected readonly current = currentBuyView();

  private readonly depthIds = BUY_DEPTH.map((d) => d.id as string);

  /** Cost stays marked while one of the views under it is open. */
  protected isOpen(id: string): boolean {
    return id === this.current() || (id === 'overview' && this.depthIds.includes(this.current()));
  }

  /** The second row is for Cost and the views under it. */
  protected readonly showDepth = computed(() => this.current() === 'overview' || this.depthIds.includes(this.current()));
}
