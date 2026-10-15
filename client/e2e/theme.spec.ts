import { expect, test } from './fixtures';

/** The colour theme: the system's until someone chooses, then theirs on every visit. */
test.describe('Theme', () => {
  test('is chosen in the footer, applied at once, and kept for the next visit', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html'), 'the system decides until a choice is made').not.toHaveAttribute('data-theme', /.+/);

    await page.getByTestId('theme-dark').click();

    await expect(page.locator('html'), 'dark at once').toHaveAttribute('data-theme', 'dark');
    await expect(page.getByTestId('theme-dark'), 'and the choice is shown as pressed').toHaveAttribute('aria-pressed', 'true');

    await page.goto('/calculator');
    await expect(page.locator('html'), 'on another page and a new load, still dark').toHaveAttribute('data-theme', 'dark');

    await page.getByTestId('theme-system').click();
    await expect(page.locator('html'), 'back to the system').not.toHaveAttribute('data-theme', /.+/);
  });
});
