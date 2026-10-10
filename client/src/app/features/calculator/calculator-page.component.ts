import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, debounceTime, map, switchMap } from 'rxjs';
import { toErrorMessages } from '../../core/errors/problem-details';
import { AmortizationRequest, AmortizationResponse } from '../../core/models/amortization.models';
import { AmortizationApiService } from '../../core/services/amortization-api.service';
import { LoanFormComponent } from './loan-form/loan-form.component';
import { PaymentBreakdownComponent } from './payment-breakdown/payment-breakdown.component';
import { SavingsSummaryComponent } from './savings-summary/savings-summary.component';
import { ScheduleTableComponent } from './schedule-table/schedule-table.component';
import { TrendsComponent } from './trends/trends.component';

/** How long to wait after the last change before calculating, so typing "375000" sends one request, not six. */
export const RECALCULATE_DELAY_MS = 400;

/**
 * Container ("smart") component: owns the state and talks to the API.
 * The children are presentational, with inputs in and outputs out.
 */
@Component({
  selector: 'app-calculator-page',
  imports: [
    CurrencyPipe,
    LoanFormComponent,
    SavingsSummaryComponent,
    PaymentBreakdownComponent,
    TrendsComponent,
    ScheduleTableComponent,
  ],
  templateUrl: './calculator-page.component.html',
  styleUrl: './calculator-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalculatorPageComponent {
  private readonly api = inject(AmortizationApiService);
  private readonly requests = new Subject<{ request: AmortizationRequest; id: number }>();

  /** Numbers each change, so only the response to the latest one can end the busy state. */
  private latestId = 0;

  /** The latest successful analysis, or null before the first one arrives. */
  readonly result = signal<AmortizationResponse | null>(null);

  /** Messages from the most recent failed request. Empty when the last request succeeded. */
  readonly errors = signal<string[]>([]);

  /** True from the first change until its result arrives, including the debounce wait. */
  readonly busy = signal(false);

  constructor() {
    // debounceTime waits for a pause in typing. switchMap then cancels an in-flight request when a
    // newer one arrives, so a slow response can never overwrite a fresher result. Errors are caught
    // per request: letting one reach the outer stream would end it and ignore every later change.
    this.requests
      .pipe(
        debounceTime(RECALCULATE_DELAY_MS),
        switchMap(({ request, id }) => {
          this.errors.set([]);
          return this.api.calculate(request).pipe(
            map((response) => ({ response, id })),
            catchError((error: unknown) => {
              this.fail(error, id);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(({ response, id }) => {
        this.result.set(response);
        this.settle(id);
      });
  }

  /** Queues a calculation; it runs after a short pause, and any calculation still in flight is cancelled. */
  calculate(request: AmortizationRequest): void {
    this.busy.set(true);
    this.requests.next({ request, id: ++this.latestId });
  }

  /** Shows the error messages and, if this was the latest change, clears the busy state. */
  private fail(error: unknown, id: number): void {
    this.errors.set(toErrorMessages(error));
    this.settle(id);
  }

  /** Ends the busy state only when the latest change has been answered; an older answer leaves it on. */
  private settle(id: number): void {
    if (id === this.latestId) this.busy.set(false);
  }
}
