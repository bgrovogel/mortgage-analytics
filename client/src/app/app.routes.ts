import { Routes } from '@angular/router';
import { CalculatorPageComponent } from './features/calculator/calculator-page.component';
import { OverviewTabComponent } from './features/calculator/tabs/overview-tab.component';
import { ProjectionTabComponent } from './features/calculator/tabs/projection-tab.component';
import { ScheduleTabComponent } from './features/calculator/tabs/schedule-tab.component';
import { signedInGuard } from './core/auth/signed-in.guard';
import { ConfirmEmailPageComponent } from './features/account/confirm-email-page.component';
import { DevMailboxPageComponent } from './features/account/dev-mailbox-page.component';
import { ForgotPasswordPageComponent } from './features/account/forgot-password-page.component';
import { ResetPasswordPageComponent } from './features/account/reset-password-page.component';
import { SignInPageComponent } from './features/account/sign-in-page.component';
import { HistoryPageComponent } from './features/history/history-page.component';
import { RefinancePageComponent } from './features/refinance/refinance-page.component';
import { StrategyPageComponent } from './features/strategy/strategy-page.component';

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
      { path: 'projection', component: ProjectionTabComponent, title: title('Projection') },
      { path: 'schedule', component: ScheduleTabComponent, title: title('Schedule') },
    ],
  },
  { path: 'refinance', component: RefinancePageComponent, title: title('Refinance') },
  { path: 'strategy', component: StrategyPageComponent, title: title('Pay off or invest') },
  { path: 'history', component: HistoryPageComponent, canActivate: [signedInGuard], title: title('History') },
  // The account pages use a focused layout: no page tabs or account controls, just a way back.
  { path: 'sign-in', component: SignInPageComponent, title: title('Sign in'), data: FOCUSED },
  // Where the links in account emails land.
  { path: 'confirm-email', component: ConfirmEmailPageComponent, title: title('Confirm email'), data: FOCUSED },
  { path: 'forgot-password', component: ForgotPasswordPageComponent, title: title('Forgot password'), data: FOCUSED },
  { path: 'reset-password', component: ResetPasswordPageComponent, title: title('Reset password'), data: FOCUSED },
  // Local demos: the emails the app "sent" (the API serves them only in Development).
  { path: 'dev/mailbox', component: DevMailboxPageComponent, title: title('Dev mailbox'), data: FOCUSED },
  { path: '**', redirectTo: 'calculator' },
];
