import { DestroyRef, Signal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subject, catchError, debounceTime, map, switchMap } from 'rxjs';
import { toErrorMessages } from '../errors/problem-details';

/** How long to wait after the last change before sending, so typing "375000" sends one request, not six. */
export const RECALCULATE_DELAY_MS = 400;

/** The state of a request that is re-sent as its input changes. */
export interface LatestRequest<TRequest, TResponse> {
  /** The latest input, set at once (before the pause), so a page opened mid-typing can restore it. */
  readonly request: Signal<TRequest | null>;
  /** The latest successful response, or null before the first one. */
  readonly result: Signal<TResponse | null>;
  /** Messages from the most recent failure. Empty once a request succeeds. */
  readonly errors: Signal<string[]>;
  /** True from the first change until its response arrives, including the pause. */
  readonly busy: Signal<boolean>;
  /** Queues a request; it is sent after a short pause, and any request still in flight is cancelled. */
  send(request: TRequest): void;
}

/**
 * Keeps one result in step with an input that changes as the user types. debounceTime waits for a
 * pause; switchMap cancels an in-flight request when a newer one arrives, so a slow response can never
 * overwrite a fresher result. Errors are caught per request: one reaching the outer stream would end it
 * and ignore every later change. Shared by the calculator and the refinance comparison (DRY).
 *
 * @param call Sends one request, e.g. `(r) => api.calculate(r)`.
 * @param destroyRef Stops listening when its owner is destroyed.
 */
export function latestRequest<TRequest, TResponse>(
  call: (request: TRequest) => Observable<TResponse>,
  destroyRef: DestroyRef,
): LatestRequest<TRequest, TResponse> {
  const request = signal<TRequest | null>(null);
  const result = signal<TResponse | null>(null);
  const errors = signal<string[]>([]);
  const busy = signal(false);
  const queue = new Subject<{ request: TRequest; id: number }>();

  // Numbers each change, so only the response to the latest one can end the busy state.
  let latestId = 0;
  const settle = (id: number) => {
    if (id === latestId) busy.set(false);
  };

  queue
    .pipe(
      debounceTime(RECALCULATE_DELAY_MS),
      switchMap(({ request: next, id }) => {
        errors.set([]);
        return call(next).pipe(
          map((response) => ({ response, id })),
          catchError((error: unknown) => {
            errors.set(toErrorMessages(error));
            settle(id);
            return EMPTY;
          }),
        );
      }),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe(({ response, id }) => {
      result.set(response);
      settle(id);
    });

  return {
    request: request.asReadonly(),
    result: result.asReadonly(),
    errors: errors.asReadonly(),
    busy: busy.asReadonly(),
    send(next: TRequest) {
      request.set(next);
      busy.set(true);
      queue.next({ request: next, id: ++latestId });
    },
  };
}
