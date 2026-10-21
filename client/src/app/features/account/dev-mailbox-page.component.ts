import { DatePipe } from '../../core/i18n/date.pipe';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DevMailboxService, OutboxEmail } from '../../core/dev/dev-mailbox.service';
import { TPipe } from '../../core/i18n/t.pipe';

/**
 * Development only: the emails the app has "sent" to its local outbox, newest first, with their links.
 * It makes sign-up confirmation and password reset work in a local demo with no mail server.
 */
@Component({
  selector: 'app-dev-mailbox-page',
  imports: [DatePipe, TPipe],
  template: `
    <section class="card wide" aria-labelledby="mailbox-title">
      <div class="title-row">
        <h1 id="mailbox-title">{{ 'Dev mailbox' | t }}</h1>
        <div class="buttons">
          <button type="button" class="secondary" (click)="load()" data-testid="mailbox-refresh">{{ 'Refresh' | t }}</button>
          @if (emails()?.length) {
            <button type="button" class="secondary" (click)="clear()" data-testid="mailbox-clear">{{ 'Clear' | t }}</button>
          }
        </div>
      </div>
      @if (emails(); as list) {
        <p class="intro">{{ 'Emails the app sent while running locally. Nothing here leaves your machine.' | t }}</p>
        @if (list.length === 0) {
          <p class="note" data-testid="mailbox-empty">{{ 'No emails yet. Create an account or ask for a password reset.' | t }}</p>
        }
        <ul class="emails">
          @for (email of list; track $index) {
            <li data-testid="mailbox-email">
              <div>
                <strong>{{ email.subject }}</strong>
                <small>{{ 'To {0} · {1}' | t: [email.to, (email.sentAt | date: 'medium')] }}</small>
              </div>
              <a class="primary" [href]="email.actionUrl">{{ 'Open link' | t }}</a>
            </li>
          }
        </ul>
      } @else if (loaded()) {
        <p class="alert" role="alert" data-testid="mailbox-unavailable">
          {{ 'The dev mailbox exists only while the API runs in Development (for example with' | t }} <code>dotnet run</code>).
        </p>
      }
    </section>
  `,
  styleUrl: './account-pages.scss',
  styles: `
    .wide { width: min(720px, 100%); }
    .title-row { display: flex; justify-content: space-between; align-items: center; }
    .buttons { display: flex; gap: 0.5rem; }
    .emails { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    li { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 0.75rem 0; border-top: 1px solid var(--border); }
    li div { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
    small { color: var(--text-muted); overflow-wrap: anywhere; }
    li .primary { padding: 0 0.9rem; flex: none; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DevMailboxPageComponent implements OnInit {
  private readonly mailbox = inject(DevMailboxService);

  /** The emails, or null when there is no development mailbox. */
  readonly emails = signal<OutboxEmail[] | null>(null);

  /** True once the first answer has come back. */
  readonly loaded = signal(false);

  ngOnInit(): void {
    this.load();
  }

  /** Empties the outbox, then shows it again. */
  clear(): void {
    this.mailbox.clear().subscribe(() => this.load());
  }

  /** Reads the outbox again. */
  load(): void {
    this.mailbox.list().subscribe((emails) => {
      this.emails.set(emails);
      this.loaded.set(true);
    });
  }
}
