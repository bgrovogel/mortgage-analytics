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
});
