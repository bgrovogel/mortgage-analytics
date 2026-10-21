import { readFile } from 'node:fs/promises';
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
    await expect(page, 'signed in from the confirmation page, on History').toHaveURL(/\/history$/);
    await expect(page.getByTestId('signed-in-as'), 'the header says who is signed in').toHaveText(email);

    await page.getByTestId('sign-out').click();
    await expect(page.getByTestId('sign-in-link'), 'signed out').toBeVisible();
    await page.goto('/history');
    await expect(page, 'History needs an account').toHaveURL(/\/sign-in\?returnUrl=%2Fhistory$/);
  });

  test('signing in from a page leads back to it, and so does the way back', async ({ account, page }) => {
    await page.request.post('/api/v1/account/logout');
    await page.goto('/refinance');
    await expect(page.getByTestId('results'), 'the Refinance page has its result').toHaveAttribute('aria-busy', 'false');

    await page.getByTestId('sign-in-link').click();
    await expect(page.getByTestId('back-to-app'), 'the way back names the page').toHaveText('← Back to Refinance');
    await page.getByTestId('account-email').fill(account.email);
    await page.getByTestId('account-password').fill(PASSWORD);
    await page.getByTestId('account-submit').click();

    await expect(page, 'signed in, back on Refinance').toHaveURL(/\/refinance$/);
  });

  test('a passkey: added on the account page, then used to sign in with no password, and removed', async ({ account, page, context }) => {
    // The browser gets a device that keeps passkeys and unlocks them itself, as a laptop's fingerprint reader would.
    const devtools = await context.newCDPSession(page);
    await devtools.send('WebAuthn.enable');
    await devtools.send('WebAuthn.addVirtualAuthenticator', {
      options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
    });
    await page.goto('/account');
    await page.getByTestId('passkey-name').fill('Test laptop');
    await page.getByTestId('passkey-add').click();
    await expect(page.getByTestId('passkey-list'), 'the passkey is listed under its name').toContainText('Test laptop');
    await expect(page.getByTestId('passkey-list'), 'and has not been used yet').toContainText('Never used');

    // Signed out, the same device signs in with it: no email, no password.
    await page.request.post('/api/v1/account/logout');
    await page.goto('/sign-in');
    await page.getByTestId('passkey-sign-in').click();
    await expect(page.getByTestId('signed-in-as'), 'signed in as the account that registered it').toHaveText(account.email);

    await page.goto('/account');
    await expect(page.getByTestId('passkey-list'), 'its use is noted').toContainText('Last used');
    await page.getByRole('button', { name: 'Remove Test laptop' }).click();
    await expect(page.getByTestId('passkeys-none'), 'removed, so none is left').toHaveText('No passkeys yet.');
  });

  test('downloads a copy of the data the account holds: the email and every saved calculation', async ({ signedIn, account, page }) => {
    await signedIn.saveAs('Oak St');
    await page.goto('/account');

    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('data-download').click()]);
    const data = JSON.parse(await readFile((await download.path())!, 'utf-8'));

    expect(download.suggestedFilename(), 'named for what it is, and dated').toMatch(/^mortgage-analytics-data-\d{4}-\d{2}-\d{2}\.json$/);
    expect(data.email, 'it is this account, not another').toBe(account.email);
    expect(data.savedCalculations.map((c: { name: string }) => c.name), 'with what was saved').toEqual(['Oak St']);
    expect(JSON.stringify(data), 'and no hash of a password').not.toMatch(/passwordHash/i);
    await expect(page.getByTestId('data-status'), 'the page says it was downloaded').toHaveText('Your data was downloaded.');
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
    await page.goto('/calculator');
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
    await expect(page, 'the email in the header opens the account page').toHaveURL(/\/account\?returnUrl=%2Fcalculator%2Foverview$/);
    await expect(page.getByTestId('back-to-app'), 'whose way back is the page it was opened from').toHaveText('← Back to the calculator');
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

