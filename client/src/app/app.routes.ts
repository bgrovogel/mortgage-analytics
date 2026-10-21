import { Routes } from '@angular/router';
import { CalculatorPageComponent } from './features/calculator/calculator-page.component';
import { OverviewTabComponent } from './features/calculator/tabs/overview-tab.component';
import { signedInGuard } from './core/auth/signed-in.guard';
import { openShareLink } from './features/share-link.guard';
import { msg } from './core/i18n/i18n';

// The calculator's overview is the landing page, so it is in the first download. Every other page
// and tab is a separate chunk, fetched when first opened and preloaded once the app is idle (app.config.ts).

/** Route data for pages shown without the page tabs (sign-in and the other account pages). */
export const FOCUSED = { layout: 'focused' } as const;

export const routes: Routes = [
  // A share link (`#share=…`) opens its inputs before the page does (features/share-link.guard.ts).
  { path: '', pathMatch: 'full', loadComponent: () => import('./features/start/start-page.component').then((m) => m.StartPageComponent), title: msg('What do you want to figure out?') },
  {
    path: 'calculator',
    component: CalculatorPageComponent,
    canActivate: [openShareLink],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      { path: 'overview', component: OverviewTabComponent, title: msg('Overview') },
      { path: 'affordability', loadComponent: () => import('./features/calculator/tabs/affordability-tab.component').then((m) => m.AffordabilityTabComponent), title: msg('Can you afford it?') },
      { path: 'closing', loadComponent: () => import('./features/calculator/tabs/closing-tab.component').then((m) => m.ClosingTabComponent), title: msg('Closing') },
      { path: 'sale', loadComponent: () => import('./features/calculator/tabs/sale-tab.component').then((m) => m.SaleTabComponent), title: msg('If you sell') },
      { path: 'rental', loadComponent: () => import('./features/calculator/tabs/rental-tab.component').then((m) => m.RentalTabComponent), title: msg('As a rental') },
      { path: 'rent-or-buy', loadComponent: () => import('./features/calculator/tabs/rent-or-buy-tab.component').then((m) => m.RentOrBuyTabComponent), title: msg('Rent or buy') },
      { path: 'projection', loadComponent: () => import('./features/calculator/tabs/projection-tab.component').then((m) => m.ProjectionTabComponent), title: msg('Projection') },
      { path: 'schedule', loadComponent: () => import('./features/calculator/tabs/schedule-tab.component').then((m) => m.ScheduleTabComponent), title: msg('Schedule') },
      // Comparing homes was a tab here before it became a page of its own: old links still land on it.
      { path: 'compare', redirectTo: '/compare' },
    ],
  },
  { path: 'compare', loadComponent: () => import('./features/compare/compare-page.component').then((m) => m.ComparePageComponent), title: msg('Compare homes'), canActivate: [openShareLink] },
  { path: 'refinance', loadComponent: () => import('./features/refinance/refinance-page.component').then((m) => m.RefinancePageComponent), title: msg('Refinance'), canActivate: [openShareLink] },
  { path: 'strategy', loadComponent: () => import('./features/strategy/strategy-page.component').then((m) => m.StrategyPageComponent), title: msg('Pay off or invest'), canActivate: [openShareLink] },
  { path: 'how-it-works', loadComponent: () => import('./features/learn/how-it-works-page.component').then((m) => m.HowItWorksPageComponent), title: msg('How it’s calculated') },
  { path: 'glossary', loadComponent: () => import('./features/learn/glossary-page.component').then((m) => m.GlossaryPageComponent), title: msg('Glossary') },
  { path: 'privacy', loadComponent: () => import('./features/learn/privacy-page.component').then((m) => m.PrivacyPageComponent), title: msg('Privacy') },
  { path: 'terms', loadComponent: () => import('./features/learn/terms-page.component').then((m) => m.TermsPageComponent), title: msg('Terms') },
  { path: 'history', loadComponent: () => import('./features/history/history-page.component').then((m) => m.HistoryPageComponent), canActivate: [signedInGuard], title: msg('History') },
  // The account pages use a focused layout: no page tabs or account controls, just a way back.
  { path: 'sign-in', loadComponent: () => import('./features/account/sign-in-page.component').then((m) => m.SignInPageComponent), title: msg('Sign in'), data: FOCUSED },
  { path: 'account', loadComponent: () => import('./features/account/account-page.component').then((m) => m.AccountPageComponent), canActivate: [signedInGuard], title: msg('Your account'), data: FOCUSED },
  // Where the links in account emails land.
  { path: 'confirm-email', loadComponent: () => import('./features/account/confirm-email-page.component').then((m) => m.ConfirmEmailPageComponent), title: msg('Confirm email'), data: FOCUSED },
  { path: 'forgot-password', loadComponent: () => import('./features/account/forgot-password-page.component').then((m) => m.ForgotPasswordPageComponent), title: msg('Forgot password'), data: FOCUSED },
  { path: 'reset-password', loadComponent: () => import('./features/account/reset-password-page.component').then((m) => m.ResetPasswordPageComponent), title: msg('Reset password'), data: FOCUSED },
  // Local demos: the emails the app "sent" (the API serves them only in Development).
  { path: 'dev/mailbox', loadComponent: () => import('./features/account/dev-mailbox-page.component').then((m) => m.DevMailboxPageComponent), title: msg('Dev mailbox'), data: FOCUSED },
  // An address that is not a page shows the questions, and says so: the address stays, so a typo can be seen and fixed.
  { path: '**', loadComponent: () => import('./features/start/start-page.component').then((m) => m.StartPageComponent), title: msg('Page not found'), data: { notFound: true } },
];
