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
 */
export const test = base.extend<{ calculator: CalculatorPage; account: Account; signedIn: CalculatorPage }>({
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
