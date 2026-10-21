import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReadingNavComponent } from './reading-nav.component';

/**
 * What happens to the numbers someone types and to their account, in plain words, by what they have done: used it
 * without an account, shared a link, signed in. It says only what the app does (docs/04-backend.md has the detail).
 */
@Component({
  selector: 'app-privacy-page',
  imports: [ReadingNavComponent, RouterLink],
  template: `
    <section class="reading" aria-labelledby="privacy-title">
      <app-reading-nav />
      <header>
        <h1 id="privacy-title">Privacy</h1>
        <p>What happens to the numbers you type, and to your account if you make one. How each answer is worked out is
          in <a routerLink="/how-it-works">How it's calculated</a>.</p>
      </header>

      <article>
        <section id="anonymous">
          <h3>Without an account</h3>
          <p>The numbers you type are sent to the server to be worked out, and the answer comes back. The server does not
            save them. There is nothing to sign up for, and every calculator works the same without an account.</p>
        </section>

        <section id="links">
          <h3>Share links</h3>
          <p>A share link holds your numbers in the part of the address after the <strong>#</strong>, which a browser
            keeps to itself and never sends to a server. Whoever opens the link sees those numbers; nothing is stored for
            them anywhere. A link to a home purchase leaves out your income and debts. Pay off or invest needs them, so
            its link includes them and says so before you copy it.</p>
        </section>

        <section id="account">
          <h3>With an account</h3>
          <p>An account is an email address and a password, which is kept scrambled so nobody, including us, can read it.
            Calculations you choose to save are kept in your account and are visible only to you. So is the order of your
            key figures, if you arranged them, so it follows you to another device.</p>
          <p>A passkey, if you add one, lets you sign in with your device's fingerprint, face or screen lock. Only its
            public half is kept here, with the name you gave it and when it was added and last used; the private half
            never leaves your device, so there is nothing to steal or to guess.</p>
          <p>You can change your password, and remove any passkey, at any time. You can download a copy of everything above
            as a file, and you can delete your account, which deletes everything above: every saved calculation, every
            passkey and your arrangement.</p>
          <p>Signing in puts a cookie in your browser that keeps you signed in. Scripts on the page cannot read it, and
            other sites cannot send it.</p>
        </section>

        <section id="browser">
          <h3>In your browser</h3>
          <p>The page remembers a few small things in your browser, only on your device: your colour theme if you picked
            one, which columns you chose for the payment schedule, the order of your key figures (also kept in your account
            when you are signed in), whether you chose to hide amounts on Saved, and that you have seen the first-visit
            tips. Clearing the site's data removes them.</p>
        </section>

        <section id="none">
          <h3>What is not here</h3>
          <p>No analytics, no advertising and no tracking, and nothing from other companies' servers is loaded on the
            page. The numbers you type are not sold or shared, because they are not kept.</p>
        </section>
      </article>
    </section>
  `,
  styleUrl: './reading-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyPageComponent {}
