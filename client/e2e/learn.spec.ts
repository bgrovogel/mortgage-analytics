import { expect, test } from './fixtures';

/** The pages that explain the numbers: reached from the footer of every page, and readable without an account. */
test.describe('How it is calculated and the glossary', () => {
  test('are one link away from any page, and worked through with the example loan', async ({ page }) => {
    await page.goto('/refinance');

    await page.getByRole('navigation', { name: 'About' }).getByRole('link', { name: 'How it’s calculated' }).click();
    await expect(page, 'the explanation has its own address').toHaveURL(/\/how-it-works$/);
    await expect(page.locator('#payment'), 'the payment worked through').toContainText('$2,325.26');

    await page.getByRole('link', { name: 'glossary', exact: true }).click();
    await expect(page, 'the glossary has its own address').toHaveURL(/\/glossary$/);
    await expect(page.getByTestId('glossary').locator('dt'), 'every term is listed').not.toHaveCount(0);
  });

  test('the privacy page is one link away, and says what is kept', async ({ page }) => {
    await page.goto('/strategy');

    await page.getByRole('navigation', { name: 'About' }).getByRole('link', { name: 'Privacy' }).click();

    await expect(page, 'privacy has its own address').toHaveURL(/\/privacy$/);
    await expect(page.locator('#anonymous'), 'it says what happens without an account').toContainText('does not save them');
  });

  test('a link can land on one term', async ({ page }) => {
    await page.goto('/glossary#term-pmi');

    await expect(page.locator('#term-pmi'), 'the term is on the page').toContainText('Private mortgage insurance');
    await expect(page.locator('#term-pmi'), 'and in view').toBeInViewport();
  });

  test('fits a phone: no page scrolls sideways', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    for (const path of ['/how-it-works', '/glossary', '/privacy']) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} fits the screen`).toBeLessThanOrEqual(0);
    }
  });
});
