import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { AmortizationResponse } from '../../../core/models/amortization.models';

type View = 'accelerated' | 'baseline';

/** The full month-by-month schedule. It doubles as the accessible table view of the chart. */
@Component({
  selector: 'app-schedule-table',
  imports: [CurrencyPipe, DatePipe],
  templateUrl: './schedule-table.component.html',
  styleUrl: './schedule-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleTableComponent {
  /** The analysis whose schedules are shown. */
  readonly result = input.required<AmortizationResponse>();

  /** Which schedule the table shows. */
  readonly view = signal<View>('accelerated');

  /** The schedule currently shown. */
  readonly schedule = computed(() => this.result()[this.view()]);

  /** True when any housing cost is present, which adds the "Taxes & fees" and "Total" columns. */
  readonly hasHousingCosts = computed(() => this.schedule().totalHousingCosts.total > 0);

  /** Payment numbers that were followed by a recast, so their rows can be marked. */
  readonly recastAfter = computed(() => new Set(this.schedule().recasts.map((r) => r.afterPaymentNumber)));
}
