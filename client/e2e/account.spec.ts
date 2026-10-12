import { PASSWORD, expect, test, uniqueEmail } from './fixtures';
import { latestEmailTo, pathOf } from './mailbox';

/** Accounts in the browser: signing up with email confirmation, signing in and out, and password reset. */
test.describe('Accounts', () => {
  test('signs up, confirms the email from the dev mailbox, signs in, and signs out', async ({ calculator, page }) => {
    const email = uniqueEmail();
    expect(await calculator.monthlyPayment.isVisible(), 'the calculator works without an account').toBe(true);

    await page.getByTestId('sign-in-link').click();
    await page.getByTestId('account-mode-create').click();
    await page.getByTestId('account-email').fill(email);
    await page.getByTestId('account-password').fill(PASSWORD);
    await page.getByTestId('account-submit').click();
    await expect(page.getByTestId('account-check-email'), 'a new account must confirm its email first').toContainText(email);

    // Locally there is no real inbox: the dev mailbox shows what was sent.
    await page.getByTestId('dev-mailbox-hint').getByRole('link').click();
    const message = page.getByTestId('mailbox-email').filter({ hasText: email });
    await expect(message, 'the confirmation email is in the dev mailbox').toContainText('Confirm your email for Mortgage Analytics');
    await message.getByRole('link', { name: 'Open link' }).click();
    await expect(page.getByTestId('confirm-email'), 'the link confirms the email').toContainText('Your email is confirmed');

    await page.getByRole('link', { name: 'Sign in' }).last().click();
    await page.getByTestId('account-email').fill(email);
    await page.getByTestId('account-password').fill(PASSWORD);
    await page.getByTestId('account-submit').click();
    await expect(page, 'signed in, on History').toHaveURL(/\/history$/);
    await expect(page.getByTestId('signed-in-as'), 'the header says who is signed in').toHaveText(email);

    await page.getByTestId('sign-out').click();
    await expect(page.getByTestId('sign-in-link'), 'signed out').toBeVisible();
    await page.goto('/history');
    await expect(page, 'History needs an account').toHaveURL(/\/sign-in\?returnUrl=%2Fhistory$/);
  });

  test('an unconfirmed email cannot sign in, and can ask for the link again', async ({ page }) => {
    const email = uniqueEmail();
    await expect(await page.request.post('/api/v1/account/register', { data: { email, password: PASSWORD } }), 'registered, not confirmed').toBeOK();

    await page.goto('/sign-in');
    await page.getByTestId('account-email').fill(email);
    await page.getByTestId('account-password').fill(PASSWORD);
    await page.getByTestId('account-submit').click();
    await expect(page.getByTestId('account-error'), 'it says why').toContainText('Confirm your email first');

    await page.getByTestId('account-resend').click();
    await expect(page.getByTestId('account-resent'), 'and sends the link again').toBeVisible();
  });

  test('a forgotten password is reset with the link in the email', async ({ account, page }) => {
    const newPassword = 'brand-new-password-2';
    await page.request.post('/api/v1/account/logout');

    await page.goto('/sign-in');
    await page.getByTestId('forgot-password-link').click();
    await page.getByTestId('forgot-email').fill(account.email);
    await page.getByTestId('forgot-submit').click();
    await expect(page.getByTestId('forgot-sent'), 'the reset email is on its way').toContainText(account.email);

    const reset = await latestEmailTo(page.request, account.email, 'Reset your Mortgage Analytics password');
    await page.goto(pathOf(reset));
    await page.getByTestId('reset-password').fill(newPassword);
    await page.getByTestId('reset-submit').click();
    await expect(page.getByTestId('reset-done'), 'the password is changed').toBeVisible();

    await page.goto('/sign-in');
    await page.getByTestId('account-email').fill(account.email);
    await page.getByTestId('account-password').fill(newPassword);
    await page.getByTestId('account-submit').click();
    await expect(page.getByTestId('signed-in-as'), 'the new password signs in').toHaveText(account.email);
  });

  test('saving while signed out asks you to sign in, then brings you back to save', async ({ account, page }) => {
    await page.request.post('/api/v1/account/logout');
    await page.goto('/');
    await page.getByTestId('home-price').fill('410000');
    await page.getByTestId('save-open').click();
    await expect(page.getByTestId('save-sign-in'), 'signed out, Save explains what it needs').toContainText('Sign in to save');

    await page.getByTestId('save-sign-in').getByRole('link', { name: 'Sign in' }).click();
    await page.getByTestId('account-email').fill(account.email);
    await page.getByTestId('account-password').fill(account.password);
    await page.getByTestId('account-submit').click();

    await expect(page, 'back where the user was').toHaveURL(/\/calculator\/overview$/);
    await expect(page.getByTestId('home-price'), 'with the calculation still there').toHaveValue('410,000');
    await page.getByTestId('save-open').click();
    await expect(page.getByTestId('save-name'), 'and now Save asks for a name').toBeVisible();
  });

  test('refuses a wrong password, in plain words', async ({ account, page }) => {
    await page.request.post('/api/v1/account/logout');
    await page.goto('/sign-in');
    await page.getByTestId('account-email').fill(account.email);
    await page.getByTestId('account-password').fill('wrong-password-1');
    await page.getByTestId('account-submit').click();

    await expect(page.getByTestId('account-error'), 'no hint about which part was wrong').toHaveText('That email and password do not match.');
  });

  test('changes the password from the account page, staying signed in', async ({ account, page }) => {
    const newPassword = 'brand-new-password-2';
    await page.goto('/account');

    await page.getByTestId('current-password').fill(account.password);
    await page.getByTestId('new-password').fill(newPassword);
    await page.getByTestId('password-submit').click();
    await expect(page.getByTestId('password-changed'), 'the change is confirmed').toContainText('Your password is changed');

    await page.reload();
    await expect(page.getByTestId('account-page-email'), 'this session carries on').toContainText(account.email);
    await page.request.post('/api/v1/account/logout');
    const withOld = await page.request.post('/api/v1/account/login?useCookies=true', { data: account });
    const withNew = await page.request.post('/api/v1/account/login?useCookies=true', { data: { email: account.email, password: newPassword } });
    expect(withOld.status(), 'the old password no longer signs in').toBe(401);
    expect(withNew.status(), 'the new one does').toBe(200);
  });

  test('deletes the account, with everything saved in it, once the password is typed', async ({ signedIn, page, account }) => {
    await signedIn.saveAs('Oak St');

    await page.getByTestId('account-link').click();
    await expect(page, 'the email in the header opens the account page').toHaveURL(/\/account$/);
    await page.getByTestId('delete-start').click();
    await page.getByTestId('delete-password').fill('wrong-password-1');
    await page.getByTestId('delete-submit').click();
    await expect(page.getByTestId('delete-error'), 'a wrong password deletes nothing').toHaveText('The password is not correct.');

    await page.getByTestId('delete-password').fill(account.password);
    await page.getByTestId('delete-submit').click();
    await expect(page.getByTestId('delete-done'), 'the right one deletes the account').toContainText('Your account is deleted');

    await page.getByRole('link', { name: 'Carry on without an account' }).click();
    await expect(page.getByTestId('sign-in-link'), 'and signs out').toBeVisible();
    const signIn = await page.request.post('/api/v1/account/login?useCookies=true', { data: account });
    expect(signIn.status(), 'the account can no longer sign in').toBe(401);
  });
});

