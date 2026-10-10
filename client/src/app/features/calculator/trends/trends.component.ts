import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { AmortizationResponse } from '../../../core/models/amortization.models';
import { BalanceChartComponent } from '../balance-chart/balance-chart.component';
import { CostProjectionComponent } from '../cost-projection/cost-projection.component';

type Tab = 'balance' | 'costs' | 'value';

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'balance', label: 'Balance' },
  { id: 'costs', label: 'Yearly costs' },
  { id: 'value', label: 'Home value' },
];

/**
 * The charts that run over time, in one card with tabs: the loan balance, the yearly costs and the
 * home value. One chart at a time keeps the page short; each still has its own caption and takeaway.
 *
 * The tabs follow the WAI-ARIA tabs pattern: only the selected tab is in the tab order, and the
 * arrow keys (plus Home and End) move between tabs, selecting as they go.
 */
@Component({
  selector: 'app-trends',
  imports: [BalanceChartComponent, CostProjectionComponent],
  template: `
    <div class="tabs" role="tablist" aria-label="Charts over time">
      @for (t of tabs; track t.id; let i = $index) {
        <button type="button" role="tab" [id]="'trends-tab-' + t.id" [attr.data-testid]="'tab-' + t.id"
                [attr.aria-selected]="tab() === t.id" [tabIndex]="tab() === t.id ? 0 : -1" aria-controls="trends-panel"
                (click)="tab.set(t.id)" (keydown)="onKeydown($event, i)">{{ t.label }}</button>
      }
    </div>
    <div class="panel-body" role="tabpanel" id="trends-panel" [attr.aria-labelledby]="'trends-tab-' + tab()">
      @if (tab() === 'balance') {
        <app-balance-chart [result]="result()" />
      } @else {
        <app-cost-projection [result]="result()" [view]="tab() === 'costs' ? 'costs' : 'value'" />
      }
    </div>
  `,
  styleUrl: './trends.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrendsComponent {
  /** The analysis the charts plot. */
  readonly result = input.required<AmortizationResponse>();

  /** The tab currently shown. */
  readonly tab = signal<Tab>('balance');

  protected readonly tabs = TABS;

  /** Arrow keys move to the previous or next tab (wrapping), Home and End to the first or last. */
  protected onKeydown(event: KeyboardEvent, index: number): void {
    const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: TABS.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const target = (next + TABS.length) % TABS.length;
    this.tab.set(TABS[target].id);
    ((event.currentTarget as HTMLElement).parentElement!.children[target] as HTMLElement).focus();
  }
}
