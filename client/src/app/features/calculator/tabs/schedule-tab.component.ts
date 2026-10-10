import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CalculatorStore } from '../calculator.store';
import { ScheduleTableComponent } from '../schedule-table/schedule-table.component';

/** Every payment, month by month or rolled up by year. */
@Component({
  selector: 'app-schedule-tab',
  imports: [ScheduleTableComponent],
  template: `<div class="panel"><app-schedule-table [result]="result()" /></div>`,
  styleUrl: './result-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleTabComponent {
  private readonly store = inject(CalculatorStore);

  /** The page only shows the tabs once there is a result. */
  readonly result = computed(() => this.store.result()!);
}
