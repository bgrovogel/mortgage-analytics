import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toErrorMessages } from '../../core/errors/problem-details';
import { AccountExportService } from '../../core/services/account-export.service';

/**
 * "Your data", on the account page: a copy of everything the account holds, as one file, so nothing here is only here.
 * It holds the email, the saved calculations with their inputs, the passkeys' names and dates, the key figures'
 * order and where the account is signed in, and never the password or a passkey's key.
 */
@Component({
  selector: 'app-data-export',
  template: `
    <div class="part" role="group" aria-labelledby="data-title">
      <h3 id="data-title">Your data</h3>
      <p>
        Download a copy of what this account holds: your email, your saved calculations with all their inputs, the names
        and dates of your passkeys, the order of your key figures, and where you are signed in (the browser and system, and when). It never includes your password or a passkey's key.
      </p>
      @if (error(); as message) {
        <p class="alert" role="alert" data-testid="data-error">{{ message }}</p>
      }
      <button type="button" class="secondary" [disabled]="busy()" (click)="download()" data-testid="data-download">Download my data</button>
      <p class="visually-hidden" role="status" aria-live="polite">{{ status() }}</p>
      @if (status(); as message) {
        <p class="note" data-testid="data-status">{{ message }}</p>
      }
    </div>
  `,
  styleUrl: './passkeys.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataExportComponent {
  private readonly exporter = inject(AccountExportService);

  /** What the last download did, for the person and for a screen reader. */
  readonly status = signal('');

  /** Why the last download failed. */
  readonly error = signal<string | null>(null);

  /** True while the data is on its way. */
  readonly busy = signal(false);

  /** Downloads the file. */
  download(): void {
    this.busy.set(true);
    this.error.set(null);
    this.status.set('');
    this.exporter.download().subscribe({
      next: () => {
        this.busy.set(false);
        this.status.set('Your data was downloaded.');
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(toErrorMessages(error).join(' '));
      },
    });
  }
}
