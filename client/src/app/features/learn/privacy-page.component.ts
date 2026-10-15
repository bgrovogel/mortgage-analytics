import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * What happens to the numbers someone types and to their account, in plain words, by what they have done: used it
 * without an account, shared a link, signed in. It says only what the app does (docs/04-backend.md has the detail).
 */
@Component({
  selector: 'app-privacy-page',
  imports: [RouterLink],
  template: `
    <section class="reading" aria-labelledby="privacy-title">
      <header>
        <h2 id="privacy-title">Privacy</h2>
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
            Calculations you choose to save are kept in your account and are visible only to you. You can change your
            password at any time, and you can delete your account: that deletes every calculation saved in it.</p>
          <p>Signing in puts a cookie in your browser that keeps you signed in. Scripts on the page cannot read it, and
            other sites cannot send it.</p>
        </section>

        <section id="browser">
          <h3>In your browser</h3>
          <p>The page remembers two small things in your browser, only on your device: which columns you chose for the
            payment schedule, and your colour theme if you picked one. Clearing the site's data removes them.</p>
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
