import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DevMailboxService } from '../../core/dev/dev-mailbox.service';
import { TPipe } from '../../core/i18n/t.pipe';

/** "Running locally? Open the dev mailbox": shown only when the API has a development mailbox. */
@Component({
  selector: 'app-dev-mailbox-hint',
  imports: [RouterLink, TPipe],
  template: `
    @if (available()) {
      <p class="hint" data-testid="dev-mailbox-hint">
        {{ 'Running locally? No real email is sent:' | t }} <a routerLink="/dev/mailbox">{{ 'open the dev mailbox' | t }}</a> {{ 'to see it.' | t }}
      </p>
    }
  `,
  styles: `
    .hint { margin: 0; font-size: 0.85rem; color: var(--text-muted); }
    a { color: var(--accent-text); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DevMailboxHintComponent {
  /** True when the API runs in Development and keeps a local outbox. */
  protected readonly available = toSignal(inject(DevMailboxService).available(), { initialValue: false });
}
