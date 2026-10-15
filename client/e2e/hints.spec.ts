import { expect, test } from './fixtures';

/** The first-visit hints: three short lines above the page, dismissed for good. */
test.describe('First visit', () => {
  test.use({ showHints: true });

  test('says where the numbers, the answer and the views are, and stays dismissed', async ({ page }) => {
    await page.goto('/calculator');

    await expect(page.getByTestId('first-visit'), 'a first visit shows the hints').toContainText('Your numbers');

    await page.getByTestId('dismiss-hints').click();
    await expect(page.getByTestId('first-visit'), 'one tap dismisses them').toBeHidden();

    await page.reload();
    await expect(page.getByTestId('results'), 'the page has loaded').toBeVisible();
    await expect(page.getByTestId('first-visit'), 'and they stay gone on the next visit').toBeHidden();
  });
});
