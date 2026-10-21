import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CalculatorStore } from '../calculator.store';
import { SaleComponent } from '../sale/sale.component';
import { TPipe } from '../../../core/i18n/t.pipe';

/**
 * If you sell: what selling the home would leave in hand each year, after the loan, the costs of selling and the tax on
 * the gain. What a sale costs and how a gain is taxed are beside the other numbers, in the form.
 */
@Component({
  selector: 'app-sale-tab',
  imports: [SaleComponent, TPipe],
  template: `
    <div class="panel flat sale">
      <h2 class="visually-hidden">{{ 'What a sale would leave' | t }}</h2>
      <p class="intro">{{ 'What you would walk away with if you sold this home: its price then, less the loan, the costs of selling and tax on any gain. The costs and the tax are with your numbers, on the left.' | t }}</p>
      @if (result().sale; as sale) {
        <app-sale [sale]="sale" />
      }
    </div>
  `,
  styleUrls: ['./result-tab.scss', './sale-tab.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaleTabComponent {
  private readonly store = inject(CalculatorStore);

  /** The page only shows the tabs once there is a result. */
  protected readonly result = computed(() => this.store.result()!);
}
