import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/** The pages in the top navigation. */
const PAGES = [
  { path: '/calculator', label: 'Calculator' },
  { path: '/refinance', label: 'Refinance' },
  { path: '/history', label: 'History' },
] as const;

/** The app shell: title, page navigation and a link to the API docs. Pages render in the outlet. */
@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <header class="app-header">
      <div>
        <h1>Mortgage Analytics</h1>
        <p>See what a home really costs, and how extra payments or a refinance change it.</p>
      </div>
      <nav class="app-nav" aria-label="Pages">
        @for (page of pages; track page.path) {
          <a [routerLink]="page.path" routerLinkActive="active" ariaCurrentWhenActive="page">{{ page.label }}</a>
        }
        <a class="external" href="/swagger" target="_blank" rel="noopener">API docs ↗</a>
      </nav>
    </header>
    <main>
      <router-outlet />
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  protected readonly pages = PAGES;
}
