import { expect, test } from './fixtures';

/**
 * Printing a page (or saving it as a PDF from the print dialog): the results alone, in the light theme whatever the
 * screen uses, under a line saying what they are for.
 */
test.describe('Print', () => {
  test.use({ colorScheme: 'dark' });

  test('prints the results in the light theme, without the form, under what they are for', async ({ calculator, page }) => {
    await calculator.set('home-price', 432_100);
    await calculator.calculate();
    // The dialog itself cannot be driven: count the calls instead.
    await page.evaluate(() => {
      (window as unknown as { printed: number }).printed = 0;
      window.print = () => { (window as unknown as { printed: number }).printed++; };
    });

    await page.getByTestId('share-menu').click();
    await page.getByTestId('print').click();
    expect(await page.evaluate(() => (window as unknown as { printed: number }).printed), 'the Print choice opens the print dialog').toBe(1);

    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('html'), 'printed in the light theme, though the screen is dark').toHaveAttribute('data-theme', 'light');
    await expect(page.getByTestId('print-summary'), 'what the printout is for').toContainText('Mortgage Analytics · Calculator: $432,100 home');
    await expect(page.getByTestId('form-panel'), 'no form on paper').toBeHidden();
    await expect(page.getByTestId('share-menu'), 'nor the page’s controls').toBeHidden();
    await expect(calculator.totalMonthlyPayment, 'but the results').toBeVisible();

    await page.emulateMedia({ media: 'screen' });
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await expect(page.locator('html'), 'back to the screen’s theme after').not.toHaveAttribute('data-theme', 'light');
    await expect(page.getByTestId('print-summary'), 'the line is for paper only').toBeHidden();
  });

  test('prints a short summary without the tables and charts, and a full printout again after', async ({ page }) => {
    await page.goto('/refinance');
    await expect(page.getByTestId('results'), 'the example has arrived').toHaveAttribute('aria-busy', 'false');
    await page.evaluate(() => {
      (window as unknown as { during: string | undefined }).during = undefined;
      window.print = () => { (window as unknown as { during: string | undefined }).during = document.documentElement.dataset['print']; };
    });

    await page.getByTestId('share-menu').click();
    await page.getByTestId('print-short').click();
    expect(await page.evaluate(() => (window as unknown as { during: string | undefined }).during), 'the page is in short mode while the dialog is open').toBe('short');

    await page.emulateMedia({ media: 'print' });
    await expect(page.getByTestId('refi-verdict'), 'the headline prints').toBeVisible();
    await expect(page.getByTestId('refi-payment'), 'with the figures').toBeVisible();
    await expect(page.getByTestId('refi-table'), 'but not the comparison table').toBeHidden();

    await page.emulateMedia({ media: 'screen' });
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await expect(page.locator('html'), 'short mode is over once it has printed').not.toHaveAttribute('data-print', 'short');

    await page.getByTestId('share-menu').click();
    await page.getByTestId('print').click();
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByTestId('refi-table'), 'the full printout keeps the table').toBeVisible();
  });

  test('keeps the homes table in a short summary of Compare, since it is the answer there', async ({ page }) => {
    await page.goto('/compare');
    await expect(page.getByTestId('results'), 'the example has arrived').toHaveAttribute('aria-busy', 'false');
    await page.evaluate(() => { window.print = () => undefined; });

    await page.getByTestId('share-menu').click();
    await page.getByTestId('print-short').click();
    await page.emulateMedia({ media: 'print' });

    await expect(page.getByTestId('compare-table'), 'the homes side by side stay').toBeVisible();
  });
});
