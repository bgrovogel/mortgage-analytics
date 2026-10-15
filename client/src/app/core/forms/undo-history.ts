import { computed, signal } from '@angular/core';

/** How long a pause makes a run of changes one step: typing "415000" is one change, not six. */
export const UNDO_PAUSE_MS = 800;

/**
 * The way back for a form: what its values were before each settled change, a few steps deep. A change is noted as
 * it happens; a pause settles it into a step. Equal values are not a change (compared as JSON), so a change put back
 * where it began leaves nothing to undo.
 */
export class UndoHistory<T> {
  private readonly steps = signal<T[]>([]);
  private settled: T;
  private pending: { value: T; timer: ReturnType<typeof setTimeout> } | null = null;

  /** True when there is a step to go back to. */
  readonly canUndo = computed(() => this.steps().length > 0);

  /**
   * @param start What the values are now: the place the first change comes from.
   * @param limit How many steps are kept; the oldest go first.
   */
  constructor(start: T, private readonly limit = 20) {
    this.settled = start;
  }

  /** Notes the values now: they become a step once changes pause. */
  note(value: T): void {
    if (this.pending) clearTimeout(this.pending.timer);
    this.pending = { value, timer: setTimeout(() => this.settle(), UNDO_PAUSE_MS) };
  }

  /** The values before the last settled change, or null when there is nothing to go back to. */
  undo(): T | null {
    this.settle();
    const steps = this.steps();
    if (steps.length === 0) return null;
    const previous = steps[steps.length - 1];
    this.steps.set(steps.slice(0, -1));
    this.settled = previous;
    return previous;
  }

  /** Starts over from `value`, with no steps: for a restore that is not a change the visitor made. */
  reset(value: T): void {
    if (this.pending) clearTimeout(this.pending.timer);
    this.pending = null;
    this.steps.set([]);
    this.settled = value;
  }

  private settle(): void {
    if (!this.pending) return;
    clearTimeout(this.pending.timer);
    const { value } = this.pending;
    this.pending = null;
    if (JSON.stringify(value) === JSON.stringify(this.settled)) return;
    this.steps.update((steps) => [...steps.slice(-(this.limit - 1)), this.settled]);
    this.settled = value;
  }
}
