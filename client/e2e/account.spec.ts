import { PASSWORD, expect, test, uniqueEmail } from './fixtures';

/** Accounts in the browser: signing up, signing out, and what needs an account. */
test.describe('Accounts', () => {
  test('creates an account, shows who is signed in, and signs out', async ({ calculator, page }) => {
    const email = uniqueEmail();
    expect(await calculator.monthlyPayment.isVisible(), 'the calculator works without an account').toBe(true);

    await page.getByTestId('sign-in-link').click();
    await page.getByTestId('account-mode-create').click();
    await page.getByTestId('account-email').fill(email);
    await page.getByTestId('account-password').fill(PASSWORD);
    await page.getByTestId('account-submit').click();

    await expect(page, 'a new account lands on its (empty) History').toHaveURL(/\/history$/);
    await expect(page.getByTestId('signed-in-as'), 'the header says who is signed in').toHaveText(email);
    await expect(page.getByTestId('history-empty'), 'nothing is saved yet').toContainText('No saved calculations yet');

    await page.getByTestId('sign-out').click();
    await expect(page.getByTestId('sign-in-link'), 'signed out').toBeVisible();

    await page.goto('/history');
    await expect(page, 'History needs an account').toHaveURL(/\/sign-in\?returnUrl=%2Fhistory$/);
  });

  test('saving while signed out asks you to sign in, then brings you back to save', async ({ calculator, page }) => {
    await calculator.set('home-price', 410_000);
    await page.getByTestId('save-open').click();
    await expect(page.getByTestId('save-sign-in'), 'signed out, Save explains what it needs').toContainText('Sign in to save');

    await page.getByTestId('save-sign-in').getByRole('link', { name: 'Sign in' }).click();
    await page.getByTestId('account-mode-create').click();
    await page.getByTestId('account-email').fill(uniqueEmail());
    await page.getByTestId('account-password').fill(PASSWORD);
    await page.getByTestId('account-submit').click();

    await expect(page, 'back where the user was').toHaveURL(/\/calculator\/overview$/);
    await expect(calculator.field('home-price'), 'with the calculation still there').toHaveValue('410,000');
    await calculator.saveAs('First home');
  });

  test('refuses a wrong password, in plain words', async ({ account, page }) => {
    await page.request.post('/api/v1/account/logout');
    await page.goto('/sign-in');
    await page.getByTestId('account-email').fill(account.email);
    await page.getByTestId('account-password').fill('wrong-password-1');
    await page.getByTestId('account-submit').click();

    await expect(page.getByTestId('account-error'), 'no hint about which part was wrong').toHaveText('That email and password do not match.');
  });
});
