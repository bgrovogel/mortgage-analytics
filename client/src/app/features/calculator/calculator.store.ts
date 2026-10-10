import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, debounceTime, map, switchMap } from 'rxjs';
import { toErrorMessages } from '../../core/errors/problem-details';
import { AmortizationRequest, AmortizationResponse } from '../../core/models/amortization.models';
import { AmortizationApiService } from '../../core/services/amortization-api.service';

/** How long to wait after the last change before calculating, so typing "375000" sends one request, not six. */
export const RECALCULATE_DELAY_MS = 400;

/**
 * The calculator's state, shared by the form, the result tabs and other pages: the latest request,
 * its result, any errors, and whether a calculation is pending. It lives for the whole app, so moving
 * between pages keeps the current calculation.
 */
@Injectable({ providedIn: 'root' })
export class CalculatorStore {
  private readonly api = inject(AmortizationApiService);
  private readonly requests = new Subject<{ request: AmortizationRequest; id: number }>();

  /** Numbers each change, so only the response to the latest one can end the busy state. */
  private latestId = 0;

  /** The latest request, or null before the first one. A form opening later restores it. */
  readonly request = signal<AmortizationRequest | null>(null);

  /** The latest successful analysis, or null before the first one arrives. */
  readonly result = signal<AmortizationResponse | null>(null);

  /** Messages from the most recent failed request. Empty when the last request succeeded. */
  readonly errors = signal<string[]>([]);

  /** True from the first change until its result arrives, including the debounce wait. */
  readonly busy = signal(false);

  /** Whether the headline numbers are on screen; when they are not, phones show a compact summary bar. */
  readonly headlineVisible = signal(false);

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
    this.request.set(request);
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
