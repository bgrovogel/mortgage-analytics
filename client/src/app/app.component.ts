import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { BrandMarkComponent } from './core/layout/brand-mark.component';
import { HeaderHeightDirective } from './core/layout/header-height.directive';
import { AuthService } from './core/auth/auth.service';
import { CalculationStores } from './features/calculation-stores';

/** The pages in the top navigation. */
const PAGES = [
  { path: '/calculator', label: 'Calculator' },
  { path: '/refinance', label: 'Refinance' },
  { path: '/strategy', label: 'Pay off or invest' },
  { path: '/history', label: 'History' },
] as const;

/** The app shell: title, page navigation, the API docs, and who is signed in. Pages render in the outlet. */
@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, HeaderHeightDirective, BrandMarkComponent],
  template: `
    @if (focused()) {
      <!-- Account pages: just the app's name and a way back, nothing to wander off to mid-sign-in. -->
      <header class="app-header focused">
        <div class="app-bar">
          <a class="brand" routerLink="/calculator"><app-brand-mark /><h1>Mortgage Analytics</h1></a>
          <a class="back" routerLink="/calculator" data-testid="back-to-app">← Back to the calculator</a>
        </div>
      </header>
    } @else {
      <header class="app-header" appHeaderHeight>
        <div class="app-bar">
        <a class="brand" routerLink="/calculator"><app-brand-mark /><h1>Mortgage Analytics</h1></a>
        <div class="header-actions">
          <nav class="app-nav" aria-label="Pages">
            @for (page of pages; track page.path) {
              <a [routerLink]="page.path" routerLinkActive="active" ariaCurrentWhenActive="page">{{ page.label }}</a>
            }
            <a class="external" href="/swagger" target="_blank" rel="noopener">API docs ↗</a>
          </nav>
          <div class="account">
            @if (auth.user(); as user) {
              <!-- The email on a wide screen; on a phone, where the email would not fit, a person icon named "Account". -->
              <a class="who" routerLink="/account" data-testid="account-link" [attr.title]="'Your account: ' + user.email">
                <span class="email" data-testid="signed-in-as">{{ user.email }}</span>
                <svg class="icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
                  <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2" />
                  <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
                <span class="short">Account</span>
              </a>
              <button type="button" class="link" (click)="signOut()" data-testid="sign-out" [attr.title]="'Signed in as ' + user.email">Sign out</button>
            } @else {
              <a routerLink="/sign-in" data-testid="sign-in-link">Sign in</a>
            }
          </div>
        </div>
        </div>
      </header>
      <p class="tagline">See what a home really costs, how extra payments or a refinance change it, and whether to pay it off or invest.</p>
    }
    <main>
      <router-outlet />
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private readonly router = inject(Router);
  protected readonly pages = PAGES;
  protected readonly auth = inject(AuthService);

  /** True on pages whose route asks for the focused layout (sign-in and the other account pages). */
  protected readonly focused = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => deepest(this.router.routerState.snapshot.root).data['layout'] === 'focused'),
    ),
    { initialValue: false },
  );
  private readonly stores = inject(CalculationStores);

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
