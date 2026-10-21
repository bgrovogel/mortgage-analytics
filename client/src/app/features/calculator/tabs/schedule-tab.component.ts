import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { saveFile } from '../../../core/files/save-file';
import { xlsx } from '../../../core/files/xlsx';
import { CalculatorStore } from '../calculator.store';
import { calculationWorkbook } from '../schedule-table/calculation-workbook';
import { ScheduleTableComponent } from '../schedule-table/schedule-table.component';

/** The type a browser and an operating system know an Excel workbook by. */
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Every payment, month by month or rolled up by year; and the whole calculation to take away as an Excel workbook. */
@Component({
  selector: 'app-schedule-tab',
  imports: [ScheduleTableComponent],
  template: `
    <div class="panel workbook" data-testid="workbook">
      <p>
        Want it in Excel? The whole calculation as a workbook: a summary, the home’s costs year by year, and every payment,
        as numbers, money and dates you can add up, chart and sort.
      </p>
      <button type="button" (click)="download()" data-testid="download-workbook">Download the workbook (.xlsx)</button>
    </div>
    <div class="panel"><app-schedule-table [result]="result()" /></div>
  `,
  styleUrls: ['./result-tab.scss', './schedule-tab.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleTabComponent {
  private readonly store = inject(CalculatorStore);

  /** The page only shows the tabs once there is a result. */
  readonly result = computed(() => this.store.result()!);

  /** Saves the calculation as a workbook. */
  download(): void {
    saveFile('mortgage-calculation.xlsx', xlsx(calculationWorkbook(this.result(), this.store.request())), XLSX_TYPE);
  }
}
