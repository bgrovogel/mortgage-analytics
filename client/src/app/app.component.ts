import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CalculatorPageComponent } from './features/calculator/calculator-page.component';

@Component({
  selector: 'app-root',
  imports: [CalculatorPageComponent],
  template: `
    <header class="app-header">
      <div>
        <h1>Mortgage Analytics</h1>
        <p>See how extra payments change your payoff date and total interest.</p>
      </div>
      <a href="/swagger" target="_blank" rel="noopener">API docs ↗</a>
    </header>
    <main>
      <app-calculator-page />
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {}
