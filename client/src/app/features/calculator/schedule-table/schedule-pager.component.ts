import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TPipe } from '../../../core/i18n/t.pipe';

/** A loan year to show, or `'all'`. */
export type SchedulePage = number | 'all';

/**
 * Moves through a long schedule a loan year at a time: back, forward, the year to show (or all of them), and which
 * payments those are. It holds nothing; the table owns which year is shown and listens.
 */
@Component({
  imports: [TPipe],
  selector: 'app-schedule-pager',
  template: `
    <div class="pager" data-testid="pager">
      <button type="button" data-testid="page-previous" [attr.aria-label]="'Previous year' | t" [disabled]="page() === 'all' || page() === 1" (click)="step(-1)">{{ '‹ Previous' | t }}</button>
      <label class="jump">
        <span class="visually-hidden">{{ 'Loan year to show' | t }}</span>
        <select data-testid="page-year" (change)="choose($event)">
          @for (year of years(); track year) {
            <option [value]="year" [selected]="page() === year">{{ 'Year {0}' | t: [year] }}</option>
          }
          <option value="all" [selected]="page() === 'all'">{{ 'All payments' | t }}</option>
        </select>
      </label>
      <button type="button" data-testid="page-next" [attr.aria-label]="'Next year' | t" [disabled]="page() === 'all' || page() === years().length" (click)="step(1)">{{ 'Next ›' | t }}</button>
      <p class="caption" data-testid="page-caption" aria-live="polite">{{ caption() }}</p>
    </div>
  `,
  styleUrl: './schedule-pager.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchedulePagerComponent {
  /** The loan years the schedule runs through. */
  readonly years = input.required<readonly number[]>();

  /** The year shown, or all of them. */
  readonly page = input.required<SchedulePage>();

  /** Which payments are on show, in words. */
  readonly caption = input.required<string>();

  /** The year (or all of them) the reader asked for. */
  readonly pageChange = output<SchedulePage>();

  /** One year back or forward. */
  protected step(by: number): void {
    const page = this.page();
    if (page !== 'all') this.pageChange.emit(page + by);
  }

  /** The choice in the list; anything that is neither a year nor "all" is ignored. */
  protected choose(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value === 'all') this.pageChange.emit('all');
    else if (/^\d+$/.test(value)) this.pageChange.emit(Number(value));
  }
}
