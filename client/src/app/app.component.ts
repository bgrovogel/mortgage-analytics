import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from './core/auth/auth.service';
import { CalculatorStore } from './features/calculator/calculator.store';
import { RefinanceStore } from './features/refinance/refinance.store';

/** The pages in the top navigation. */
const PAGES = [
  { path: '/calculator', label: 'Calculator' },
  { path: '/refinance', label: 'Refinance' },
  { path: '/history', label: 'History' },
] as const;

/** The app shell: title, page navigation, the API docs, and who is signed in. Pages render in the outlet. */
@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    @if (focused()) {
      <!-- Account pages: just the app's name and a way back, nothing to wander off to mid-sign-in. -->
      <header class="app-header focused">
        <h1><a routerLink="/calculator">Mortgage Analytics</a></h1>
        <a class="back" routerLink="/calculator" data-testid="back-to-app">← Back to the calculator</a>
      </header>
    } @else {
      <header class="app-header">
        <div>
          <h1>Mortgage Analytics</h1>
          <p>See what a home really costs, and how extra payments or a refinance change it.</p>
        </div>
        <div class="header-actions">
          <nav class="app-nav" aria-label="Pages">
            @for (page of pages; track page.path) {
              <a [routerLink]="page.path" routerLinkActive="active" ariaCurrentWhenActive="page">{{ page.label }}</a>
            }
            <a class="external" href="/swagger" target="_blank" rel="noopener">API docs ↗</a>
          </nav>
          <div class="account">
            @if (auth.user(); as user) {
              <span class="who" data-testid="signed-in-as">{{ user.email }}</span>
              <button type="button" class="link" (click)="signOut()" data-testid="sign-out">Sign out</button>
            } @else {
              <a routerLink="/sign-in" data-testid="sign-in-link">Sign in</a>
            }
          </div>
        </div>
      </header>
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
  private readonly calculator = inject(CalculatorStore);
  private readonly refinance = inject(RefinanceStore);

  /** Signs out. The pages stop pointing at saved items, which belonged to the account. */
  signOut(): void {
    this.auth.signOut().subscribe(() => {
      this.calculator.saved.set(null);
      this.refinance.saved.set(null);
      void this.router.navigateByUrl('/calculator');
    });
  }
}

/** The innermost active route, whose data describes the page being shown. */
function deepest(route: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
  return route.firstChild ? deepest(route.firstChild) : route;
}
