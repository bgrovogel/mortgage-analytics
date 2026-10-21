import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toErrorMessages } from '../../core/errors/problem-details';
import { SessionsApiService, UserSession } from '../../core/services/sessions-api.service';
import { TPipe } from '../../core/i18n/t.pipe';

/**
 * Where the account is signed in, on the account page: each browser or device with when it signed in and was last used,
 * the one in use marked. Another can be signed out from here, or every other at once, which is the thing to do on a lost
 * phone or a shared computer. A device that is signed out is refused at its next request.
 */
@Component({
  selector: 'app-sessions',
  imports: [DatePipe, TPipe],
  template: `
    <div class="part" role="group" aria-labelledby="sessions-title">
      <h3 id="sessions-title">{{ 'Where you’re signed in' | t }}</h3>
      <p>
        {{ 'Each browser or device signed in to your account. If you don’t recognise one, or left yourself signed in on a shared computer, sign it out here. A device you sign out is signed out at its next request.' | t }}
      </p>
      @if (list().length > 0) {
        <ul class="session-list" data-testid="session-list">
          @for (session of list(); track session.id) {
            <li>
              <span class="session-name">
                <strong>{{ session.device }}</strong>
                @if (session.current) {
                  <span class="badge" data-testid="session-current">{{ 'This device' | t }}</span>
                }
                <small>{{ 'Signed in {0} · Last active {1}' | t: [(session.createdAt | date: 'mediumDate'), (session.lastSeenAt | date: ('MMM d, h:mm a' | t))] }}</small>
              </span>
              @if (!session.current) {
                <button type="button" class="secondary" [attr.aria-label]="'Sign out {0}' | t: [session.device]" (click)="end(session)">{{ 'Sign out' | t }}</button>
              }
            </li>
          }
        </ul>
        @if (others() > 0) {
          <button type="button" class="secondary" (click)="endOthers()" [disabled]="busy()" data-testid="sessions-end-others">{{ 'Sign out everywhere else' | t }}</button>
        }
      } @else if (loaded()) {
        <p class="hint" data-testid="sessions-none">{{ 'Signed in on this device only, from before sessions were listed. Sign in again to see it here.' | t }}</p>
      }
      @if (error(); as message) {
        <p class="alert" role="alert" data-testid="sessions-error">{{ message }}</p>
      }
      <p class="visually-hidden" role="status" aria-live="polite">{{ status() }}</p>
      @if (status(); as message) {
        <p class="note" data-testid="sessions-status">{{ message }}</p>
      }
    </div>
  `,
  styleUrl: './sessions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionsComponent {
  private readonly api = inject(SessionsApiService);

  /** The account's sessions. */
  readonly list = signal<UserSession[]>([]);

  /** True once the list has arrived, so "none" is not said while it is still on its way. */
  readonly loaded = signal(false);

  /** What the last action did, for the person and for a screen reader. */
  readonly status = signal('');

  /** Why the last action failed. */
  readonly error = signal<string | null>(null);

  /** True while ending sessions. */
  readonly busy = signal(false);

  /** How many sessions besides this one. */
  protected readonly others = computed(() => this.list().filter((s) => !s.current).length);

  constructor() {
    this.reload();
  }

  /** Signs one device out. */
  end(session: UserSession): void {
    this.error.set(null);
    this.api.end(session.id).subscribe({
      next: () => {
        this.status.set(`${session.device} signed out.`);
        this.reload();
      },
      error: (error: unknown) => this.error.set(toErrorMessages(error).join(' ')),
    });
  }

  /** Signs out every device but this one. */
  endOthers(): void {
    this.error.set(null);
    this.busy.set(true);
    this.api.endOthers().subscribe({
      next: ({ ended }) => {
        this.busy.set(false);
        this.status.set(ended === 1 ? '1 other device signed out.' : `${ended} other devices signed out.`);
        this.reload();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(toErrorMessages(error).join(' '));
      },
    });
  }

  private reload(): void {
    this.api.list().subscribe({
      next: (sessions) => {
        this.list.set(sessions);
        this.loaded.set(true);
      },
      error: (error: unknown) => {
        this.loaded.set(true);
        this.error.set(toErrorMessages(error).join(' '));
      },
    });
  }
}
