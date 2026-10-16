import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { toErrorMessages } from '../../core/errors/problem-details';
import { Passkey, PasskeyService } from '../../core/auth/passkey.service';

/**
 * Passkeys, on the account page: sign in with the device's fingerprint, face or screen lock instead of a password. Each
 * is listed with when it was added and last used, can be removed, and a new one is added under a name that tells the
 * devices apart. Nothing secret is stored here: a passkey's private half never leaves the device.
 */
@Component({
  selector: 'app-passkeys',
  imports: [ReactiveFormsModule, DatePipe],
  template: `
    <div class="part" role="group" aria-labelledby="passkeys-title">
      <h3 id="passkeys-title">Passkeys</h3>
      <p>
        Sign in with your fingerprint, face or screen lock instead of a password. A passkey stays on your device; nothing
        secret is kept here, so there is nothing to guess or to steal.
      </p>
      @if (!passkeys.supported()) {
        <p class="note" data-testid="passkeys-unsupported">This browser cannot make passkeys.</p>
      } @else {
        @if (list().length > 0) {
          <ul class="passkey-list" data-testid="passkey-list">
            @for (passkey of list(); track passkey.id) {
              <li>
                <span class="passkey-name">
                  <strong>{{ passkey.name }}</strong>
                  <small>Added {{ passkey.createdAt | date: 'mediumDate' }} · {{ passkey.lastUsedAt ? 'Last used ' + (passkey.lastUsedAt | date: 'mediumDate') : 'Never used' }}</small>
                </span>
                <button type="button" class="secondary" [attr.aria-label]="'Remove ' + passkey.name" (click)="remove(passkey)">Remove</button>
              </li>
            }
          </ul>
        } @else {
          <p class="hint" data-testid="passkeys-none">No passkeys yet.</p>
        }
        <form [formGroup]="form" (submit)="$event.preventDefault(); add()" novalidate data-testid="passkey-form">
          <label class="field">
            <span>Name for this passkey</span>
            <input type="text" formControlName="name" maxlength="50" autocomplete="off" data-testid="passkey-name" [attr.aria-invalid]="nameInvalid()" />
            @if (nameInvalid()) {
              <small class="error" data-testid="passkey-name-error">Give the passkey a name.</small>
            }
          </label>
          @if (error(); as message) {
            <p class="alert" role="alert" data-testid="passkey-error">{{ message }}</p>
          }
          <button type="submit" class="secondary" [disabled]="busy()" data-testid="passkey-add">Add a passkey</button>
        </form>
        <p class="visually-hidden" role="status" aria-live="polite" data-testid="passkey-status-live">{{ status() }}</p>
        @if (status(); as message) {
          <p class="note" data-testid="passkey-status">{{ message }}</p>
        }
      }
    </div>
  `,
  styleUrl: './passkeys.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasskeysComponent {
  protected readonly passkeys = inject(PasskeyService);

  /** The user's passkeys. */
  readonly list = signal<Passkey[]>([]);

  /** What the last action did, for the person and for a screen reader. */
  readonly status = signal('');

  /** Why the last attempt was refused (too many passkeys, a device that would not make one). */
  readonly error = signal<string | null>(null);

  /** True while the device or the API is working. */
  readonly busy = signal(false);

  /** The name box, starting with something so a name is never in the way. */
  readonly form = inject(NonNullableFormBuilder).group({ name: ['This device'] });

  constructor() {
    if (this.passkeys.supported()) this.reload();
  }

  /** True when the name is blank and the person has tried to add. */
  protected readonly nameInvalid = signal(false);

  /** Has the device make a passkey under the name; closing its prompt changes nothing. */
  add(): void {
    const name = this.form.controls.name.value.trim();
    this.nameInvalid.set(name === '');
    if (name === '') return;
    this.busy.set(true);
    this.error.set(null);
    this.status.set('');
    this.passkeys.register(name).subscribe({
      next: (added) => {
        this.busy.set(false);
        if (!added) return;
        this.status.set('Passkey added.');
        this.reload();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(toErrorMessages(error).join(' '));
      },
    });
  }

  /** Removes a passkey. Signing in with the password still works, and a passkey can be added again. */
  remove(passkey: Passkey): void {
    this.error.set(null);
    this.passkeys.remove(passkey.id).subscribe({
      next: () => {
        this.status.set(`${passkey.name} removed.`);
        this.reload();
      },
      error: (error: unknown) => this.error.set(toErrorMessages(error).join(' ')),
    });
  }

  private reload(): void {
    this.passkeys.list().subscribe((passkeys) => this.list.set(passkeys));
  }
}
