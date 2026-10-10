import { DestroyRef, computed, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { INPUTS_FIELD, SavedCalculation, SavedCalculationKind, SavedInputs, savedInputsFor } from '../models/saved-calculation.models';
import { latestRequest } from './latest-request';

/** The saved calculation a page is showing: enough to update it in place, and to name it. */
export type SavedLink = Pick<SavedCalculation, 'id' | 'name'>;

/**
 * The state of one calculator page (purchase, refinance, or pay off or invest): the latest request, its result,
 * errors, whether a result is pending, and the saved calculation it is linked to. A page's store lives for the
 * whole app, so leaving the page and coming back keeps its numbers.
 *
 * Each page says only what differs: how to send a request, which kind of saved calculation it opens, and how
 * to describe and name its inputs. Everything else is written once here (DRY).
 */
export abstract class CalculationStore<TRequest, TResponse> {
  /** The kind of saved calculation this page shows. */
  abstract readonly kind: SavedCalculationKind;

  /** Where a saved calculation of this kind opens. */
  abstract readonly route: readonly string[];

  private readonly latest = latestRequest<TRequest, TResponse>((request) => this.send$(request), inject(DestroyRef));

  /** The latest request, or null before the first one. A form opening later restores it. */
  readonly request = this.latest.request;

  /** The latest successful result, or null before the first one arrives. */
  readonly result = this.latest.result;

  /** Messages from the most recent failed request. Empty when the last request succeeded. */
  readonly errors = this.latest.errors;

  /** True from the first change until its result arrives, including the pause. */
  readonly busy = this.latest.busy;

  /** The saved calculation the current one came from or was saved as, so it can be updated in place. */
  readonly saved = signal<SavedLink | null>(null);

  /** What Save stores: the current inputs, once there are any. */
  readonly savePayload = computed<SavedInputs | null>(() => {
    const request = this.request();
    return request ? savedInputsFor(this.kind, request) : null;
  });

  /** The name Save suggests for the current inputs. */
  readonly suggestedName = computed(() => {
    const request = this.request();
    return request ? this.suggestName(request) : '';
  });

  /** Queues a request; it is sent after a short pause, and any request still in flight is cancelled. */
  send(request: TRequest): void {
    this.latest.send(request);
  }

  /** Loads a saved calculation of this page's kind (others are ignored); later saves can update it in place. */
  open(calculation: SavedCalculation): void {
    if (calculation.kind !== this.kind) return;
    this.linkTo(calculation);
    this.send(this.inputsOf(calculation));
  }

  /** Records that the current calculation is this saved one (after saving or renaming it). */
  linkTo({ id, name }: SavedLink): void {
    this.saved.set({ id, name });
  }

  /** The inputs a saved calculation of this page's kind holds. */
  inputsOf(calculation: SavedCalculation): TRequest {
    return calculation[INPUTS_FIELD[this.kind]] as TRequest;
  }

  /** One line that tells saved calculations of this kind apart, e.g. in History. */
  abstract describe(request: TRequest): string;

  /** A starting name for saving these inputs. */
  abstract suggestName(request: TRequest): string;

  /** Sends one request to the API. */
  protected abstract send$(request: TRequest): Observable<TResponse>;
}
