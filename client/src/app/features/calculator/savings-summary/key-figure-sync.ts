import { Injectable, effect, inject, untracked } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { KeyFiguresApiService } from '../../../core/services/key-figures-api.service';
import { KpiPreferences } from './kpi-preferences';

/** How long the arrangement must stay as it is before it is sent: a few quick moves are one change. */
export const SYNC_DELAY_MS = 600;

/**
 * Keeps the key-figure arrangement with the account of whoever is signed in, so it follows them to every device. On
 * signing in, the account's arrangement is taken; when it has none, this device's is given to it. After that a change
 * is sent once it has settled. Signed out, nothing is sent: the arrangement stays in this browser. Nothing is sent
 * before the account has been heard from, so an early change cannot overwrite what it holds.
 */
@Injectable({ providedIn: 'root' })
export class KeyFigureSync {
  private readonly auth = inject(AuthService);
  private readonly api = inject(KeyFiguresApiService);
  private readonly prefs = inject(KpiPreferences);

  /** The arrangement the account is known to hold, as `key()` writes it; null until it has been heard from. */
  private known: string | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      const user = this.auth.user();
      untracked(() => (user ? this.pull() : this.forget()));
    });
    effect(() => {
      this.prefs.order(); // reads the arrangement, so each change comes here
      this.prefs.hidden();
      untracked(() => this.schedule());
    });
  }

  /** The arrangement as the account would hold it: the page's own is held as nothing chosen. */
  private key(): string {
    return JSON.stringify(this.prefs.isDefault() ? { order: [], hidden: [] } : this.prefs.arrangement());
  }

  private pull(): void {
    this.api.get().subscribe({
      next: (account) => {
        if (account.order.length > 0) this.prefs.apply(account);
        // Now the account and this device agree, except where the account has nothing and this device does.
        this.known = account.order.length > 0 ? this.key() : JSON.stringify({ order: [], hidden: [] });
        this.schedule();
      },
      error: () => undefined, // the arrangement stays in this browser
    });
  }

  private forget(): void {
    clearTimeout(this.timer);
    this.known = null;
  }

  /** Sends the arrangement once it has stopped changing, if the account does not hold it already. */
  private schedule(): void {
    clearTimeout(this.timer);
    if (this.known === null || this.key() === this.known) return;
    this.timer = setTimeout(() => {
      const sent = this.key();
      const arrangement = this.prefs.isDefault() ? { order: [], hidden: [] } : this.prefs.arrangement();
      this.api.save(arrangement).subscribe({ next: () => (this.known = sent), error: () => undefined });
    }, SYNC_DELAY_MS);
  }
}
