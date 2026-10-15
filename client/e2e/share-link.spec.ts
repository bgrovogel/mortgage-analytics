import { expect, test } from './fixtures';
import { CalculatorPage } from './calculator.page';

/**
 * Sharing a calculation by link: the inputs travel in the URL's fragment, so the link opens the same numbers in any
 * browser, signed in or not, with nothing stored on the server.
 */
test.describe('Share links', () => {
  test('copies a link that opens the same numbers in another browser, without the income', async ({ calculator, page, browser }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await calculator.set('home-price', 432_100);
    await calculator.set('monthly-extra', 350);
    await calculator.set('annual-income', 150_000);
    await calculator.calculate();
    await calculator.showResults('closing');

    await page.getByTestId('share-menu').click();
    await page.getByTestId('share-copy').click();
    await expect(page.getByTestId('share-status'), 'the link is copied, and says what it leaves out')
      .toHaveText('Link copied. Anyone with it sees these numbers. Your income and debts are left out.');
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link, 'a link to this tab, with the inputs after the #').toMatch(/\/calculator\/closing#share=[\w-]+$/);

    // Someone else: a new browser context, with none of this one's state.
    const other = await browser.newContext();
    try {
      const theirs = await other.newPage();
      await theirs.goto(link);
      const theirCalculator = new CalculatorPage(theirs);

      await expect(theirs, 'the link opens its tab, and drops the inputs from the address').toHaveURL(/\/calculator\/closing$/);
      await expect(theirCalculator.field('home-price'), 'the shared price').toHaveValue('432,100');
      await expect(theirCalculator.field('monthly-extra'), 'and the shared extra payment').toHaveValue('350');
      await theirCalculator.calculate();
      await theirCalculator.showResults('affordability');
      await expect(theirs.getByTestId('add-income'), 'but not the income').toBeVisible();
    } finally {
      await other.close();
    }
  });

  test('says when a link cannot be opened, and opens the page as usual', async ({ page }) => {
    await page.goto('/refinance#share=cut-sho');

    await expect(page.getByTestId('link-problem'), 'the page says why')
      .toContainText('This link could not be opened. It may have been cut short when it was copied.');
    await expect(page, 'the broken link is dropped from the address').toHaveURL(/\/refinance$/);
    await expect(page.getByTestId('results'), 'the page still works').toHaveAttribute('aria-busy', 'false');
  });
});
