import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CalculatorStore } from '../calculator.store';
import { CostProjectionComponent } from '../cost-projection/cost-projection.component';

/** The long view, year by year: what the home costs to own, and what it is worth against what is taxed. */
@Component({
  selector: 'app-projection-tab',
  imports: [CostProjectionComponent],
  template: `
    <div class="panel"><app-cost-projection [result]="result()" view="costs" /></div>
    <div class="panel"><app-cost-projection [result]="result()" view="value" /></div>
  `,
  styleUrl: './result-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectionTabComponent {
  private readonly store = inject(CalculatorStore);

  /** The page only shows the tabs once there is a result. */
  readonly result = computed(() => this.store.result()!);
}
