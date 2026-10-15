import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

/** Where the link in the reset email lands: choose a new password, then sign in with it. */
@Component({
  selector: 'app-reset-password-page',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="card" aria-labelledby="reset-title" aria-live="polite">
      <h1 id="reset-title">Choose a new password</h1>
      @switch (status()) {
        @case ('done') {
          <p class="note" role="status" data-testid="reset-done">Your password is changed. Sign in with the new one.</p>
          <a class="primary" routerLink="/sign-in">Sign in</a>
        }
        @case ('invalid') {
          <p class="alert" role="alert" data-testid="reset-invalid">
            This reset link is incomplete, already used or out of date.
          </p>
          <div class="links"><a routerLink="/forgot-password">Ask for a new link</a></div>
        }
        @default {
          <p class="intro">For {{ email }}.</p>
          <form [formGroup]="form" (submit)="$event.preventDefault(); submit()" novalidate data-testid="reset-form">
            <label class="field">
              <span>New password</span>
              <input type="password" formControlName="password" autocomplete="new-password" data-testid="reset-password"
                     [attr.aria-invalid]="form.controls.password.invalid && form.controls.password.touched" />
              @if (form.controls.password.invalid && form.controls.password.touched) {
                <small class="error">At least 8 characters, with a number.</small>
              }
            </label>
            <button type="submit" class="primary" [disabled]="status() === 'working'" data-testid="reset-submit">Change password</button>
          </form>
        }
      }
    </section>
  `,
  styleUrl: './account-pages.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPageComponent {
  private readonly auth = inject(AuthService);
  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;

  /** The account, from the link. */
  protected readonly email = this.query.get('email') ?? '';
  private readonly code = this.query.get('code') ?? '';

  /** Where the reset stands; a link without an email or code is invalid from the start. */
  readonly status = signal<'ready' | 'working' | 'done' | 'invalid'>(this.email && this.code ? 'ready' : 'invalid');

  readonly form = inject(NonNullableFormBuilder).group({
    // Mirrors the server's rule: 8+ characters with a digit.
    password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/\d/)]],
  });

  /** Sets the new password with the code from the link. */
  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.status.set('working');
    this.auth.resetPassword(this.email, this.code, this.form.getRawValue().password).subscribe({
      next: () => this.status.set('done'),
      // A used, altered or expired code all come back as one validation error; the remedy is the same.
      error: () => this.status.set('invalid'),
    });
  }
}
