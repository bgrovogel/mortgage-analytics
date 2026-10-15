import { ChangeDetectionStrategy, Component, Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';

/**
 * The views of buying a home, each its own URL so it can be bookmarked, shared and reached with the back button.
 * Four questions sit in the row: what it costs, whether you can afford it, rent or buy, and Compare (a page of its own
 * that takes the calculator's loan as Home A). The three views under Cost, the closing costs, the years and every
 * payment, are one step down: a second row shown with Cost, so the first row stays four questions, not seven tabs.
 */
export const BUY_VIEWS = [
  { id: 'overview', link: '/calculator/overview', label: 'Cost' },
  { id: 'affordability', link: '/calculator/affordability', label: 'Can I afford it?' },
  { id: 'rent-or-buy', link: '/calculator/rent-or-buy', label: 'Rent or buy?' },
  { id: 'compare', link: '/compare', label: 'Compare' },
] as const;

/** Under Cost, in the order a buyer goes deeper. */
export const BUY_DEPTH = [
  { id: 'closing', link: '/calculator/closing', label: 'Closing costs' },
  { id: 'projection', link: '/calculator/projection', label: 'Year by year' },
  { id: 'schedule', link: '/calculator/schedule', label: 'Every payment' },
] as const;

/** Every view's id, in the order a buyer meets them. */
export const BUY_TABS = [BUY_VIEWS[0], BUY_VIEWS[1], BUY_DEPTH[0], BUY_VIEWS[2], BUY_DEPTH[1], BUY_DEPTH[2], BUY_VIEWS[3]] as const;

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
  imports: [RouterLink],
  template: `
    <nav class="result-tabs" aria-label="Results">
      @for (view of views; track view.id) {
        <a [routerLink]="view.link" [class.active]="isOpen(view.id)" [attr.aria-current]="view.id === current() ? 'page' : null"
           [attr.data-testid]="'result-tab-' + view.id">{{ view.label }}</a>
      }
    </nav>
    @if (showDepth()) {
      <nav class="depth" aria-label="Go deeper" data-testid="depth-views">
        <span class="lead">Go deeper</span>
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
