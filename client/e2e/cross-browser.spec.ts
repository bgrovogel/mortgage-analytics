import { expect, test } from './fixtures';

/**
 * What differs between browsers, and so what a Chromium-only run cannot vouch for: the native dialog, a range input
 * moved by keys, the SVG charts, the theme kept in the browser's storage, and a page's script not throwing. The whole
 * suite runs in Chromium; this, with the layout and chart checks, also runs in Firefox and WebKit (`npm run e2e:cross`).
 */
test.describe('In every browser', () => {
  test('the calculator works out a payment, and every result view opens without a script error', async ({ calculator, page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await expect(calculator.headline, 'the first result is shown').toBeVisible();
    for (const view of ['affordability', 'closing', 'rent-or-buy', 'projection', 'sale', 'rental', 'schedule'] as const) {
      await calculator.showResults(view);
      await expect(page.locator('app-calculation-page'), `the ${view} view is open`).toContainText('$');
    }

    expect(await page.locator('body').innerText(), 'no number is broken').not.toContain('NaN');
    expect(errors, 'no script threw').toEqual([]);
  });

  test('a chart is read with the keyboard: arrow keys move the scrubber and the tooltip follows', async ({ calculator, page }) => {
    await calculator.showResults('projection');
    const input = page.getByTestId('scrub-input').first();
    await input.scrollIntoViewIfNeeded();
    await input.focus();
    const before = await page.getByTestId('scrub-title').first().innerText();

    for (let i = 0; i < 12; i++) await input.press('ArrowRight');

    await expect(page.getByTestId('scrub-title').first(), 'twelve steps on, the tooltip names another month').not.toHaveText(before);
  });

  test('a dialog opens over the page, and Escape closes it and gives focus back', async ({ calculator, page }) => {
    await calculator.showResults('closing');

    await page.getByTestId('open-loan-estimate').click();
    await expect(page.getByRole('dialog'), 'the dialog is open').toBeVisible();
    await page.keyboard.press('Escape');

    await expect(page.getByRole('dialog'), 'Escape closes it').toBeHidden();
    await expect(page.getByTestId('open-loan-estimate'), 'focus is back where it was').toBeFocused();
  });

  test('refinancing and pay off or invest each answer', async ({ page }) => {
    await page.goto('/refinance');
    await expect(page.getByTestId('refi-verdict'), 'the refinance verdict is shown').toContainText('$');

    await page.goto('/strategy');
    await expect(page.locator('app-scrub-chart svg').first(), 'the strategy chart is drawn').toBeVisible();
  });

  test('a theme choice is kept in the browser for the next visit', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('theme-dark').click();

    await page.goto('/calculator');

    await expect(page.locator('html'), 'still dark').toHaveAttribute('data-theme', 'dark');
  });
});
