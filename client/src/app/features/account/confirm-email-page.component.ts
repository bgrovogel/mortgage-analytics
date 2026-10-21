import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { TPipe } from '../../core/i18n/t.pipe';

/** Where the link in the confirmation email lands: it confirms the address, then offers to sign in. */
@Component({
  selector: 'app-confirm-email-page',
  imports: [RouterLink, TPipe],
  template: `
    <section class="card" aria-live="polite" data-testid="confirm-email">
      @switch (status()) {
        @case ('working') {
          <h1>{{ 'Confirming your email…' | t }}</h1>
        }
        @case ('done') {
          <h1>{{ 'Your email is confirmed' | t }}</h1>
          <p class="intro">{{ 'Your account is ready. Sign in to save calculations and see your history.' | t }}</p>
          <a class="primary" routerLink="/sign-in">{{ 'Sign in' | t }}</a>
        }
        @case ('failed') {
          <h1>{{ 'That link did not work' | t }}</h1>
          <p class="intro">
            {{ 'It may be incomplete or out of date. Try signing in: if your email still needs confirming, you can ask for a new link there.' | t }}
          </p>
          <a class="primary" routerLink="/sign-in">{{ 'Go to sign in' | t }}</a>
        }
      }
    </section>
  `,
  styleUrl: './account-pages.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmEmailPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;

  /** Where confirming stands. */
  readonly status = signal<'working' | 'done' | 'failed'>('working');

  /** Confirms with the user id and code from the link; a link missing either cannot work. */
  ngOnInit(): void {
    const userId = this.query.get('userId');
    const code = this.query.get('code');
    if (!userId || !code) {
      this.status.set('failed');
      return;
    }
    this.auth.confirmEmail(userId, code, this.query.get('changedEmail')).subscribe({
      next: () => this.status.set('done'),
      error: () => this.status.set('failed'),
    });
  }
}
