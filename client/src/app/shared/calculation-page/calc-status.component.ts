import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { CalculationStore } from '../../core/state/calculation-store';

/** How long a calculation takes before the page says so: a quick answer never flickers a "Calculating". */
export const CALCULATING_AFTER_MS = 300;

/**
 * One pill for where the numbers stand, in five states that differ in shape and words, not only color: up to date,
 * calculating (after 300ms), offline with the last result kept, could not calculate with a way to retry, and last
 * valid numbers (the form has something to fix, so what is shown is for the inputs before it). Says nothing before
 * there is a first result.
 */
@Component({
  selector: 'app-calc-status',
  template: `
    @if (state(); as s) {
      <span class="pill" [attr.data-state]="s" role="status" data-testid="calc-status">
        @switch (s) {
          @case ('ok') {
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="currentColor" /></svg>
            Up to date
          }
          @case ('busy') {
            <svg class="spin" aria-hidden="true" width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="20 18" stroke-linecap="round" /></svg>
            Calculating
          }
          @case ('offline') {
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2" /><path d="M3 13 13 3" stroke="currentColor" stroke-width="2" /></svg>
            Offline · last result kept
          }
          @case ('stale') {
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16"><rect x="3" y="3" width="3.5" height="10" rx="1" fill="currentColor" /><rect x="9.5" y="3" width="3.5" height="10" rx="1" fill="currentColor" /></svg>
            Last valid numbers
          }
          @case ('error') {
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16"><path d="M8 2 15 14H1Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" /><path d="M8 6.5v3.5M8 12v.1" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
            Couldn't calculate ·
            <button type="button" class="retry" data-testid="calc-status-retry" (click)="store().retry()">Retry</button>
          }
        }
      </span>
    }
  `,
  styleUrl: './calc-status.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalcStatusComponent {
  /** The page's state. */
  readonly store = input.required<CalculationStore<unknown, unknown>>();

  /** True while the form has something to fix: the numbers shown are for the inputs before it. */
  readonly fixing = input(false);

  private readonly slow = signal(false);
  private readonly online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);

  protected readonly state = computed<'ok' | 'busy' | 'offline' | 'error' | 'stale' | null>(() => {
    const store = this.store();
    if (store.errors().length > 0) return 'error';
    if (this.fixing() && store.result()) return 'stale';
    if (!this.online()) return store.result() ? 'offline' : null;
    if (this.slow() && store.busy()) return 'busy';
    return store.result() ? 'ok' : null;
  });

  constructor() {
    const destroy = inject(DestroyRef);
    const up = () => this.online.set(true);
    const down = () => this.online.set(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    destroy.onDestroy(() => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    });

    // "Calculating" only once a calculation has taken 300ms.
    effect((onCleanup) => {
      if (!this.store().busy()) {
        untracked(() => this.slow.set(false));
        return;
      }
      const timer = setTimeout(() => this.slow.set(true), CALCULATING_AFTER_MS);
      onCleanup(() => clearTimeout(timer));
    });
  }
}
