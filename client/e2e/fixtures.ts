import { expect, test as base } from '@playwright/test';
import { CalculatorPage } from './calculator.page';
import { latestEmailTo } from './mailbox';

/** A password that meets the API's rules (8+ characters with a digit). */
export const PASSWORD = 'correct-horse-1';

/** A user account created for one test. */
export interface Account {
  email: string;
  password: string;
}

/** A fresh email for every account, so tests never share one. */
export const uniqueEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

/**
 * Playwright fixtures: each test receives what it needs, ready, instead of sharing mutable state set up
 * in beforeEach.
 * - `calculator`: the app opened on the calculator, first result rendered (signed out).
 * - `account`: a new user, registered, confirmed (with the link from the dev mailbox) and signed in through
 *   the API. `page.request` shares the browser's cookies, so the browser is signed in too.
 * - `signedIn`: the calculator, opened after signing in.
 * - `showHints` (option, off): the first-visit hints are dismissed before each page loads, so they do not sit above
 *   every test's page; a test of the hints turns it on with `test.use({ showHints: true })`.
 * - `withinContentSecurityPolicy` (automatic): fails any test in which the browser blocked something under the
 *   app's Content-Security-Policy, so a change that only works without the policy cannot pass.
 */
export const test = base.extend<{
  calculator: CalculatorPage;
  account: Account;
  signedIn: CalculatorPage;
  withinContentSecurityPolicy: void;
  showHints: boolean;
  dismissHints: void;
}>({
  showHints: [false, { option: true }],
  dismissHints: [
    async ({ page, showHints }, use) => {
      if (!showHints) await page.addInitScript(() => localStorage.setItem('first-visit-hints', '1'));
      await use();
    },
    { auto: true },
  ],

  withinContentSecurityPolicy: [
    async ({ page }, use) => {
      const violations: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error' && message.text().includes('Content Security Policy')) violations.push(message.text());
      });
      await use();
      expect(violations, 'the browser blocked nothing under the Content-Security-Policy').toEqual([]);
    },
    { auto: true },
  ],

  calculator: async ({ page }, use) => {
    const calculator = new CalculatorPage(page);
    await calculator.open();
    await use(calculator);
  },

  account: async ({ page }, use) => {
    const account = { email: uniqueEmail(), password: PASSWORD };
    await expect(await page.request.post('/api/v1/account/register', { data: account }), 'the test account is created').toBeOK();
    const confirmation = await latestEmailTo(page.request, account.email);
    const query = new URL(confirmation.actionUrl).search;
    await expect(await page.request.get(`/api/v1/account/confirmEmail${query}`), 'its email is confirmed').toBeOK();
    await expect(await page.request.post('/api/v1/account/login?useCookies=true', { data: account }), 'and signed in').toBeOK();
    await use(account);
  },

  signedIn: async ({ account, page }, use) => {
    expect(account.email, 'signed in before the app opens').toBeTruthy();
    const calculator = new CalculatorPage(page);
    await calculator.open();
    await use(calculator);
  },
});

export { expect } from '@playwright/test';
