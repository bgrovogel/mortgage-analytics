import { Routes } from '@angular/router';
import { CalculatorPageComponent } from './features/calculator/calculator-page.component';
import { OverviewTabComponent } from './features/calculator/tabs/overview-tab.component';
import { ProjectionTabComponent } from './features/calculator/tabs/projection-tab.component';
import { ScheduleTabComponent } from './features/calculator/tabs/schedule-tab.component';
import { HistoryPageComponent } from './features/history/history-page.component';
import { RefinancePageComponent } from './features/refinance/refinance-page.component';

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
  { path: 'history', component: HistoryPageComponent, title: title('History') },
  { path: '**', redirectTo: 'calculator' },
];
