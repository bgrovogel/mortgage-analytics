import { Routes } from '@angular/router';
import { CalculatorPageComponent } from './features/calculator/calculator-page.component';
import { OverviewTabComponent } from './features/calculator/tabs/overview-tab.component';
import { signedInGuard } from './core/auth/signed-in.guard';

// The calculator's overview is the landing page, so it (and Chart.js) is in the first download. Every other page
// and tab is a separate chunk, fetched when first opened and preloaded once the app is idle (app.config.ts).

/** Route data for pages shown without the page tabs (sign-in and the other account pages). */
export const FOCUSED = { layout: 'focused' } as const;

/** Every page title ends with the app name. */
const title = (page: string) => `${page} · Mortgage Analytics`;

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'calculator' },
  {
    path: 'calculator',
    component: CalculatorPageComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      { path: 'overview', component: OverviewTabComponent, title: title('Overview') },
      { path: 'projection', loadComponent: () => import('./features/calculator/tabs/projection-tab.component').then((m) => m.ProjectionTabComponent), title: title('Projection') },
      { path: 'schedule', loadComponent: () => import('./features/calculator/tabs/schedule-tab.component').then((m) => m.ScheduleTabComponent), title: title('Schedule') },
    ],
  },
  { path: 'refinance', loadComponent: () => import('./features/refinance/refinance-page.component').then((m) => m.RefinancePageComponent), title: title('Refinance') },
  { path: 'strategy', loadComponent: () => import('./features/strategy/strategy-page.component').then((m) => m.StrategyPageComponent), title: title('Pay off or invest') },
  { path: 'history', loadComponent: () => import('./features/history/history-page.component').then((m) => m.HistoryPageComponent), canActivate: [signedInGuard], title: title('History') },
  // The account pages use a focused layout: no page tabs or account controls, just a way back.
  { path: 'sign-in', loadComponent: () => import('./features/account/sign-in-page.component').then((m) => m.SignInPageComponent), title: title('Sign in'), data: FOCUSED },
  { path: 'account', loadComponent: () => import('./features/account/account-page.component').then((m) => m.AccountPageComponent), canActivate: [signedInGuard], title: title('Your account'), data: FOCUSED },
  // Where the links in account emails land.
  { path: 'confirm-email', loadComponent: () => import('./features/account/confirm-email-page.component').then((m) => m.ConfirmEmailPageComponent), title: title('Confirm email'), data: FOCUSED },
  { path: 'forgot-password', loadComponent: () => import('./features/account/forgot-password-page.component').then((m) => m.ForgotPasswordPageComponent), title: title('Forgot password'), data: FOCUSED },
  { path: 'reset-password', loadComponent: () => import('./features/account/reset-password-page.component').then((m) => m.ResetPasswordPageComponent), title: title('Reset password'), data: FOCUSED },
  // Local demos: the emails the app "sent" (the API serves them only in Development).
  { path: 'dev/mailbox', loadComponent: () => import('./features/account/dev-mailbox-page.component').then((m) => m.DevMailboxPageComponent), title: title('Dev mailbox'), data: FOCUSED },
  { path: '**', redirectTo: 'calculator' },
];
