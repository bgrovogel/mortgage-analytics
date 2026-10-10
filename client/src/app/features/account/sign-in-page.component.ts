import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { safeReturnUrl } from '../../core/auth/signed-in.guard';
import { toErrorMessages } from '../../core/errors/problem-details';

type Mode = 'sign-in' | 'create';

/**
 * Sign in, or create an account, on one page. Afterwards it returns to where the user was heading
 * (`?returnUrl=`), but only within this site.
 */
@Component({
  selector: 'app-sign-in-page',
  imports: [ReactiveFormsModule],
  templateUrl: './sign-in-page.component.html',
  styleUrl: './sign-in-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignInPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly returnUrl = safeReturnUrl(inject(ActivatedRoute).snapshot.queryParamMap.get('returnUrl'));

  /** Signing in to an existing account, or creating a new one. */
  readonly mode = signal<Mode>('sign-in');

  /** What went wrong with the last attempt. */
  readonly error = signal<string | null>(null);

  /** True while a request is on its way. */
  readonly busy = signal(false);

  readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    // Mirrors the server's rule: 8+ characters with a digit. The server checks again regardless.
    password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/\d/)]],
  });

  /** Switches between signing in and creating an account. */
  setMode(mode: Mode): void {
    this.mode.set(mode);
    this.error.set(null);
  }

  /** Signs in or creates the account, then returns to where the user was heading. */
  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    const attempt: Observable<void> = this.mode() === 'create' ? this.auth.register(email, password) : this.auth.signIn(email, password);

    this.busy.set(true);
    this.error.set(null);
    attempt.subscribe({
      next: () => {
        this.busy.set(false);
        void this.router.navigateByUrl(this.returnUrl);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(
          error instanceof HttpErrorResponse && error.status === 401
            ? 'That email and password do not match.'
            : toErrorMessages(error).join(' '),
        );
      },
    });
  }

  /** True when a field should show its error. */
  showError(name: 'email' | 'password'): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }
}
