import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { toErrorMessages } from '../../core/errors/problem-details';
import { CalculationStores } from '../calculation-stores';
import { DataExportComponent } from './data-export.component';
import { PasskeysComponent } from './passkeys.component';
import { SessionsComponent } from './sessions.component';

/**
 * The signed-in account: change its password, add passkeys to sign in with, or delete it. Changing the password needs the current one; the API
 * keeps this session and ends every other. Deleting takes two deliberate steps: open the delete section, then type
 * the password. The API checks the password, deletes the account with everything saved in it, and ends every
 * session, here and on other devices.
 */
@Component({
  selector: 'app-account-page',
  imports: [ReactiveFormsModule, RouterLink, PasskeysComponent, SessionsComponent, DataExportComponent],
  template: `
    <section class="card" aria-labelledby="account-page-title" aria-live="polite">
      <h1 id="account-page-title">Your account</h1>
      @if (status() === 'done') {
        <p class="note" role="status" data-testid="delete-done">
          Your account is deleted, with every calculation saved in it. The calculators still work without one.
        </p>
        <a class="primary" routerLink="/calculator" data-testid="delete-done-continue">Carry on without an account</a>
      } @else {
        <p class="intro" data-testid="account-page-email">Signed in as <strong>{{ email }}</strong>.</p>

        <div class="part" role="group" aria-labelledby="password-title">
          <h3 id="password-title">Change your password</h3>
          <form [formGroup]="passwordForm" (submit)="$event.preventDefault(); changePassword()" novalidate data-testid="password-form">
            <label class="field">
              <span>Current password</span>
              <input type="password" formControlName="current" autocomplete="current-password" data-testid="current-password"
                     [attr.aria-invalid]="passwordForm.controls.current.invalid && passwordForm.controls.current.touched" />
              @if (passwordForm.controls.current.invalid && passwordForm.controls.current.touched) {
                <small class="error">Enter your password.</small>
              }
            </label>
            <label class="field">
              <span>New password</span>
              <input type="password" formControlName="next" autocomplete="new-password" data-testid="new-password"
                     [attr.aria-invalid]="passwordForm.controls.next.invalid && passwordForm.controls.next.touched" />
              @if (passwordForm.controls.next.invalid && passwordForm.controls.next.touched) {
                <small class="error">At least 8 characters, with a number.</small>
              }
            </label>
            @if (passwordError(); as message) {
              <p class="alert" role="alert" data-testid="password-error">{{ message }}</p>
            }
            @if (passwordStatus() === 'changed') {
              <p class="note" role="status" data-testid="password-changed">
                Your password is changed. Any other device signed in to this account has been signed out.
              </p>
            }
            <button type="submit" class="secondary" [disabled]="passwordStatus() === 'working'" data-testid="password-submit">Change password</button>
          </form>
        </div>

        <app-passkeys />

        <app-sessions />

        <app-data-export />

        <div class="danger" role="group" aria-labelledby="delete-title">
          <h3 id="delete-title">Delete your account</h3>
          <p>
            This deletes your account and every calculation saved in it, and signs you out on every device.
            It cannot be undone.
          </p>
          @if (status() === 'idle') {
            <button type="button" class="secondary destructive" (click)="start()" data-testid="delete-start">Delete my account…</button>
          } @else {
            <form [formGroup]="form" (submit)="$event.preventDefault(); submit()" novalidate data-testid="delete-form">
              <label class="field">
                <span>Your password, to confirm</span>
                <input type="password" formControlName="password" autocomplete="current-password" data-testid="delete-password"
                       [attr.aria-invalid]="form.controls.password.invalid && form.controls.password.touched" />
                @if (form.controls.password.invalid && form.controls.password.touched) {
                  <small class="error">Enter your password.</small>
                }
              </label>
              @if (error(); as message) {
                <p class="alert" role="alert" data-testid="delete-error">{{ message }}</p>
              }
              <div class="actions">
                <button type="submit" class="primary destructive" [disabled]="status() === 'working'" data-testid="delete-submit">
                  Delete my account forever
                </button>
                <button type="button" class="secondary" [disabled]="status() === 'working'" (click)="cancel()" data-testid="delete-cancel">
                  Keep my account
                </button>
              </div>
            </form>
          }
        </div>
      }
    </section>
  `,
  styleUrl: './account-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountPageComponent {
  private readonly auth = inject(AuthService);
  private readonly stores = inject(CalculationStores);

  /** The account's email; the route is guarded, so someone is signed in. */
  protected readonly email = this.auth.user()?.email ?? '';

  /** Where deleting stands: not started, asking for the password, on its way, or done. */
  readonly status = signal<'idle' | 'confirming' | 'working' | 'done'>('idle');

  /** Why the last attempt was refused (a wrong password, or too many of them). */
  readonly error = signal<string | null>(null);

  readonly form = inject(NonNullableFormBuilder).group({
    password: ['', Validators.required],
  });

  /** Where changing the password stands. */
  readonly passwordStatus = signal<'ready' | 'working' | 'changed'>('ready');

  /** Why the last password change was refused (a wrong current password, or a new one the rules reject). */
  readonly passwordError = signal<string | null>(null);

  readonly passwordForm = inject(NonNullableFormBuilder).group({
    current: ['', Validators.required],
    // Mirrors the server's rule: 8+ characters with a digit. The server checks again regardless.
    next: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/\d/)]],
  });

  /** Changes the password; on success the form is cleared, so no password stays on screen. */
  changePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const { current, next } = this.passwordForm.getRawValue();
    this.passwordStatus.set('working');
    this.passwordError.set(null);
    this.auth.changePassword(current, next).subscribe({
      next: () => {
        this.passwordForm.reset();
        this.passwordStatus.set('changed');
      },
      error: (error: unknown) => {
        this.passwordError.set(toErrorMessages(error).join(' '));
        this.passwordStatus.set('ready');
      },
    });
  }

  /** Opens the delete step, which asks for the password. */
  start(): void {
    this.status.set('confirming');
  }

  /** Closes the delete step, forgetting the password typed. */
  cancel(): void {
    this.form.reset();
    this.error.set(null);
    this.status.set('idle');
  }

  /** Deletes the account. The pages stop pointing at saved items, which went with it. */
  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.status.set('working');
    this.error.set(null);
    this.auth.deleteAccount(this.form.getRawValue().password).subscribe({
      next: () => {
        this.stores.unlinkAll();
        this.status.set('done');
      },
      error: (error: unknown) => {
        this.error.set(toErrorMessages(error).join(' '));
        this.status.set('confirming');
      },
    });
  }
}
