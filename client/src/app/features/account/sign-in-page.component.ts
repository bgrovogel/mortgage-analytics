import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { PasskeyService } from '../../core/auth/passkey.service';
import { safeReturnUrl } from '../../core/auth/signed-in.guard';
import { toErrorMessages } from '../../core/errors/problem-details';
import { DevMailboxHintComponent } from './dev-mailbox-hint.component';

type Mode = 'sign-in' | 'create';

/**
 * Sign in, or create an account, on one page. A new account must confirm its email before signing in, so
 * creating one ends on "check your email"; signing in with an unconfirmed email offers to send the link
 * again. After signing in it returns to where the user was heading (`?returnUrl=`), but only within this site.
 */
@Component({
  selector: 'app-sign-in-page',
  imports: [ReactiveFormsModule, RouterLink, DevMailboxHintComponent],
  templateUrl: './sign-in-page.component.html',
  styleUrl: './account-pages.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignInPageComponent {
  private readonly auth = inject(AuthService);
  protected readonly passkeys = inject(PasskeyService);
  private readonly router = inject(Router);
  private readonly returnUrl = safeReturnUrl(inject(ActivatedRoute).snapshot.queryParamMap.get('returnUrl'));

  /** Signing in to an existing account, or creating a new one. */
  readonly mode = signal<Mode>('sign-in');

  /** What went wrong with the last attempt. */
  readonly error = signal<string | null>(null);

  /** True while a request is on its way. */
  readonly busy = signal(false);

  /** The address a confirmation email was just sent to (after creating an account). */
  readonly sentTo = signal<string | null>(null);

  /** True when sign-in failed only because the email is not confirmed yet. */
  readonly needsConfirmation = signal(false);

  /** True once the confirmation email has been sent again. */
  readonly resent = signal(false);

  readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    // Mirrors the server's rule: 8+ characters with a digit. The server checks again regardless.
    password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/\d/)]],
  });

  /** Switches between signing in and creating an account. */
  setMode(mode: Mode): void {
    this.mode.set(mode);
    this.error.set(null);
    this.needsConfirmation.set(false);
  }

  /** Signs in or creates the account, then returns to where the user was heading. */
  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    const creating = this.mode() === 'create';
    const attempt: Observable<void> = creating ? this.auth.register(email, password) : this.auth.signIn(email, password);

    this.busy.set(true);
    this.error.set(null);
    this.needsConfirmation.set(false);
    attempt.subscribe({
      next: () => {
        this.busy.set(false);
        if (creating) this.sentTo.set(email);
        else void this.router.navigateByUrl(this.returnUrl);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(this.messageFor(error));
      },
    });
  }

  /** Signs in with a passkey the device holds, with no password; closing the device's prompt is not an error. */
  signInWithPasskey(): void {
    this.busy.set(true);
    this.error.set(null);
    this.passkeys.signIn().subscribe({
      next: (result) => {
        this.busy.set(false);
        if (result === 'signed-in') void this.router.navigateByUrl(this.returnUrl);
      },
      error: () => {
        this.busy.set(false);
        this.error.set('That passkey could not sign you in. Try your password instead.');
      },
    });
  }

  /** Sends the confirmation email again, to the address in the form. */
  resend(): void {
    this.auth.resendConfirmation(this.sentTo() ?? this.form.controls.email.value).subscribe(() => this.resent.set(true));
  }

  /** Identity answers a failed sign-in with 401 and "Failed" (wrong password) or "NotAllowed" (unconfirmed email). */
  private messageFor(error: unknown): string {
    if (!(error instanceof HttpErrorResponse) || error.status !== 401) return toErrorMessages(error).join(' ');
    if ((error.error as { detail?: string } | null)?.detail === 'NotAllowed') {
      this.needsConfirmation.set(true);
      return 'Confirm your email first, with the link we sent when you created the account.';
    }
    return 'That email and password do not match.';
  }

  /** True when a field should show its error. */
  showError(name: 'email' | 'password'): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }
}
