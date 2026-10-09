import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, switchMap } from 'rxjs';
import { toErrorMessages } from '../../core/errors/problem-details';
import { AmortizationRequest, AmortizationResponse } from '../../core/models/amortization.models';
import { AmortizationApiService } from '../../core/services/amortization-api.service';
import { BalanceChartComponent } from './balance-chart/balance-chart.component';
import { LoanFormComponent } from './loan-form/loan-form.component';
import { PaymentBreakdownComponent } from './payment-breakdown/payment-breakdown.component';
import { SavingsSummaryComponent } from './savings-summary/savings-summary.component';
import { ScheduleTableComponent } from './schedule-table/schedule-table.component';

/**
 * Container ("smart") component: owns the state and talks to the API.
 * The children are presentational, with inputs in and outputs out.
 */
@Component({
  selector: 'app-calculator-page',
  imports: [
    LoanFormComponent,
    SavingsSummaryComponent,
    PaymentBreakdownComponent,
    BalanceChartComponent,
    ScheduleTableComponent,
  ],
  templateUrl: './calculator-page.component.html',
  styleUrl: './calculator-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalculatorPageComponent {
  private readonly api = inject(AmortizationApiService);
  private readonly requests = new Subject<AmortizationRequest>();

  /** The latest successful analysis, or null before the first one arrives. */
  readonly result = signal<AmortizationResponse | null>(null);

  /** Messages from the most recent failed request. Empty when the last request succeeded. */
  readonly errors = signal<string[]>([]);

  /** True while a request is in flight. */
  readonly busy = signal(false);

  constructor() {
    // switchMap cancels an in-flight request when a newer one arrives, so a slow
    // response can never overwrite a fresher result. Errors are caught per request:
    // letting one reach the outer stream would end it and ignore every later click.
    this.requests
      .pipe(
        switchMap((request) => {
          this.busy.set(true);
          this.errors.set([]);
          return this.api.calculate(request).pipe(
            catchError((error: unknown) => {
              this.fail(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((response) => {
        this.result.set(response);
        this.busy.set(false);
      });
  }

  /** Queues a calculation. Any calculation still in flight is cancelled. */
  calculate(request: AmortizationRequest): void {
    this.requests.next(request);
  }

  /** Shows the error messages and clears the busy state. */
  private fail(error: unknown): void {
    this.errors.set(toErrorMessages(error));
    this.busy.set(false);
  }
}
