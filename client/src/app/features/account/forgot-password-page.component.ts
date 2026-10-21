import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { toErrorMessages } from '../../core/errors/problem-details';
import { DevMailboxHintComponent } from './dev-mailbox-hint.component';
import { TPipe } from '../../core/i18n/t.pipe';

/**
 * Asks for a password-reset email. The answer is the same whether or not the address has an account,
 * so the page cannot be used to find out who is registered.
 */
@Component({
  selector: 'app-forgot-password-page',
  imports: [ReactiveFormsModule, RouterLink, DevMailboxHintComponent, TPipe],
  template: `
    <section class="card" aria-labelledby="forgot-title">
      <h1 id="forgot-title">{{ 'Forgot your password?' | t }}</h1>
      @if (sentTo(); as email) {
        <p class="note" role="status" data-testid="forgot-sent">
          {{ 'If there is an account for {0}, a link to choose a new password is on its way.' | t: [email] }}
        </p>
        <app-dev-mailbox-hint />
        <div class="links"><a routerLink="/sign-in">{{ 'Back to sign in' | t }}</a></div>
      } @else {
        <p class="intro">{{ 'Enter your email and we will send you a link to choose a new password.' | t }}</p>
        <form [formGroup]="form" (submit)="$event.preventDefault(); submit()" novalidate data-testid="forgot-form">
          <label class="field">
            <span>{{ 'Email' | t }}</span>
            <input type="email" formControlName="email" autocomplete="email" data-testid="forgot-email"
                   [attr.aria-invalid]="form.controls.email.invalid && form.controls.email.touched" />
            @if (form.controls.email.invalid && form.controls.email.touched) {
              <small class="error">{{ 'Enter a valid email address.' | t }}</small>
            }
          </label>
          @if (error(); as message) {
            <p class="alert" role="alert">{{ message }}</p>
          }
          <button type="submit" class="primary" [disabled]="busy()" data-testid="forgot-submit">{{ 'Send the link' | t }}</button>
        </form>
        <div class="links"><a routerLink="/sign-in">{{ 'Back to sign in' | t }}</a></div>
      }
    </section>
  `,
  styleUrl: './account-pages.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordPageComponent {
  private readonly auth = inject(AuthService);

  readonly form = inject(NonNullableFormBuilder).group({ email: ['', [Validators.required, Validators.email]] });

  /** The address the link was sent to, once sent. */
  readonly sentTo = signal<string | null>(null);

  /** What went wrong (only a failure to reach the server; the answer never says whether an account exists). */
  readonly error = signal<string | null>(null);

  /** True while the request is on its way. */
  readonly busy = signal(false);

  /** Asks for the reset email. */
  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email } = this.form.getRawValue();
    this.busy.set(true);
    this.auth.forgotPassword(email).subscribe({
      next: () => {
        this.busy.set(false);
        this.sentTo.set(email);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(toErrorMessages(error).join(' '));
      },
    });
  }
}
