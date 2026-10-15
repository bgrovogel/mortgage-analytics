import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { BrandMarkComponent } from './core/layout/brand-mark.component';
import { printInLightTheme } from './core/layout/print';
import { applyTheme, loadTheme } from './core/layout/theme';
import { ThemeSwitchComponent } from './core/layout/theme-switch.component';
import { AuthService } from './core/auth/auth.service';
import { CalculationStores } from './features/calculation-stores';

/**
 * The pages in the top navigation: one for each thing a buyer is deciding. Buying a home also holds Compare, which is
 * a view of it, so that link stays marked while Compare is open.
 */
const PAGES: readonly { path: string; label: string; also?: readonly string[] }[] = [
  { path: '/calculator', label: 'Buy a home', also: ['/compare'] },
  { path: '/refinance', label: 'Refinance' },
  { path: '/strategy', label: 'Pay off or invest' },
  { path: '/history', label: 'Saved' },
];

/** The app shell: title, page navigation and who is signed in; the API docs in the footer. Pages render in the outlet. */
@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet, BrandMarkComponent, ThemeSwitchComponent],
  template: `
    <a class="skip-link" href="#main" (click)="skipToPage($event)">Skip to the page</a>
    @if (focused()) {
      <!-- Account pages: just the app's name and a way back, nothing to wander off to mid-sign-in. -->
      <header class="app-header focused">
        <div class="app-bar">
          <a class="brand" routerLink="/"><app-brand-mark /><h1>Mortgage Analytics</h1></a>
          <a class="back" [routerLink]="back().path" data-testid="back-to-app">← Back to {{ back().name }}</a>
        </div>
      </header>
    } @else {
      <header class="app-header">
        <div class="app-bar">
        <a class="brand" routerLink="/"><app-brand-mark /><h1>Mortgage Analytics</h1></a>
        <div class="header-actions">
          <nav class="app-nav" aria-label="Pages">
            @for (page of pages; track page.path) {
              <a [routerLink]="page.path" [class.active]="isCurrent(page)" [attr.aria-current]="isCurrent(page) ? 'page' : null">{{ page.label }}</a>
            }
          </nav>
          <div class="account">
            @if (auth.user(); as user) {
              <!-- The email on a wide screen; on a phone, where the email would not fit, a person icon named "Account". -->
              <a class="who" routerLink="/account" [queryParams]="{ returnUrl: url() }" data-testid="account-link" [attr.title]="'Your account: ' + user.email">
                <span class="email" data-testid="signed-in-as">{{ user.email }}</span>
                <svg class="icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
                  <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2" />
                  <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
                <span class="short">Account</span>
              </a>
              <button type="button" class="link" (click)="signOut()" data-testid="sign-out" [attr.title]="'Signed in as ' + user.email">Sign out</button>
            } @else {
              <!-- Signing in comes back to this page, and the sign-in page's way back names it. -->
              <a routerLink="/sign-in" [queryParams]="{ returnUrl: url() }" data-testid="sign-in-link">Sign in</a>
            }
          </div>
        </div>
        </div>
      </header>
    }
    <main id="main" tabindex="-1">
      <router-outlet />
    </main>
    @if (!focused()) {
      <!-- For developers, apart from the pages: the API every page is built on. -->
      <footer class="app-footer">
        <nav class="footer-links" aria-label="About">
          <a routerLink="/how-it-works">How it’s calculated</a>
          <a routerLink="/glossary">Glossary</a>
          <a routerLink="/privacy">Privacy</a>
        </nav>
        <a href="/swagger" target="_blank" rel="noopener">Developer API docs ↗</a>
        <app-theme-switch />
        <span>Mortgage Analytics: a .NET 10 API and an Angular 22 app</span>
      </footer>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private readonly router = inject(Router);
  protected readonly pages = PAGES;
  protected readonly auth = inject(AuthService);

  constructor() {
    // The theme chosen on an earlier visit, on every page including the account pages that have no footer.
    applyTheme(window, loadTheme());
    // Every page prints in the light theme (core/layout/print.ts).
    inject(DestroyRef).onDestroy(printInLightTheme(window));
  }

  /** The URL of the page shown. */
  protected readonly url = toSignal(
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd), map(() => this.router.url)),
    { initialValue: this.router.url },
  );

  /** True for the page the visitor is on, or one of the views it holds (`/calculator/closing`, `/compare`). */
  protected isCurrent(page: (typeof PAGES)[number]): boolean {
    const path = this.url().split(/[?#]/)[0];
    return [page.path, ...(page.also ?? [])].some((p) => path === p || path.startsWith(`${p}/`));
  }

  /**
   * Where an account page's way back leads: the page the visitor came from (`?returnUrl=`), by name. History is left
   * out while signed out, as going back there would only lead to signing in again; anything not a page here, or no
   * page at all, leads to the calculator.
   */
  protected readonly back = computed(() => {
    const returnUrl = this.router.parseUrl(this.url()).queryParams['returnUrl'];
    const path = typeof returnUrl === 'string' ? returnUrl.split(/[?#]/)[0] : '';
    const page = PAGES.find((p) => (path === p.path || path.startsWith(`${p.path}/`)) && (p.path !== '/history' || this.auth.user()));
    return page && page.path !== '/calculator' ? { path, name: page.label } : { path: page ? path : '/calculator', name: 'the calculator' };
  });

  /** True on pages whose route asks for the focused layout (sign-in and the other account pages). */
  protected readonly focused = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => deepest(this.router.routerState.snapshot.root).data['layout'] === 'focused'),
    ),
    { initialValue: false },
  );
  private readonly stores = inject(CalculationStores);

  /** Moves focus past the header to the page. A plain `#main` link would be taken by the router as a navigation. */
  protected skipToPage(event: Event): void {
    event.preventDefault();
    (document.getElementById('main') as HTMLElement | null)?.focus();
  }

  /** Signs out. The pages stop pointing at saved items, which belonged to the account. */
  signOut(): void {
    this.auth.signOut().subscribe(() => {
      this.stores.unlinkAll();
      void this.router.navigateByUrl('/calculator');
    });
  }
}

/** The innermost active route, whose data describes the page being shown. */
function deepest(route: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
  return route.firstChild ? deepest(route.firstChild) : route;
}
