import { expect, test } from './fixtures';

/** The way in: a question first. Every card opens the page that answers it, and the brand leads back. */
test.describe('Start page', () => {
  test('opens on what to figure out, and each question opens its page', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'What do you want to figure out?' }), 'a question, not a form').toBeVisible();
    await expect(page.getByTestId('start-questions').getByRole('link'), 'six questions').toHaveCount(6);

    await page.getByRole('link', { name: /Should I refinance\?/ }).click();
    await expect(page, 'the refinance question opens Refinance').toHaveURL(/\/refinance$/);
    await expect(page.getByTestId('refinance-form'), 'with its form').toBeVisible();

    await page.getByRole('link', { name: 'Mortgage Analytics', exact: false }).first().click();
    await expect(page, 'the brand leads back to the questions').toHaveURL(/\/$/);
  });

  test('marks Buy a home while a view of it is open, Compare included', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Which home is better\?/ }).click();

    await expect(page, 'the comparison').toHaveURL(/\/compare$/);
    await expect(page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name: 'Buy a home' }), 'is still Buy a home').toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('result-tab-compare'), 'and Compare is the view').toHaveAttribute('aria-current', 'page');

    await page.getByTestId('result-tab-overview').click();
    await expect(page, 'a view of buying leads back to the calculator').toHaveURL(/\/calculator\/overview$/);
  });

  test('sends an address that is not a page back to the questions', async ({ page }) => {
    await page.goto('/no-such-page');

    await expect(page, 'an address that is not a page leads to the questions').toHaveURL(/\/$/);
  });
});
