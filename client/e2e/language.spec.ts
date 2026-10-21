import { expect, test } from './fixtures';

/** The language switch: one press in the header, on every page, remembered for the next visit. */
test.describe('Language', () => {
  test('is switched with one press in the header, on any page, and the page keeps what was typed', async ({ calculator, page }) => {
    await expect(page.locator('html'), 'English to begin with').toHaveAttribute('lang', 'en');
    await calculator.set('home-price', 512_000);

    await page.getByTestId('language-es').click();

    await expect(page.locator('html'), 'the page is in Spanish').toHaveAttribute('lang', 'es');
    await expect(page.getByTestId('language-es'), 'and says which is in use').toHaveAttribute('aria-pressed', 'true');
    await expect(calculator.field('home-price'), 'what was typed is still there: nothing reloaded').toHaveValue('512,000');

    await page.getByTestId('language-en').click();

    await expect(page.locator('html'), 'and back again at one press').toHaveAttribute('lang', 'en');
  });

  test('is remembered for the next visit, and on every other page', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('language-es').click();

    await page.goto('/refinance');
    await expect(page.locator('html'), 'still Spanish on another page, and after a new load').toHaveAttribute('lang', 'es');
    await expect(page.getByTestId('language-es'), 'with the switch in the header there too').toHaveAttribute('aria-pressed', 'true');
  });

  test.describe('for a browser that prefers Spanish', () => {
    test.use({ locale: 'es-MX' });

    test('the first visit is in Spanish, until the visitor chooses', async ({ page }) => {
      await page.goto('/');

      await expect(page.locator('html'), 'it starts in Spanish').toHaveAttribute('lang', 'es');

      await page.getByTestId('language-en').click();
      await page.goto('/glossary');
      await expect(page.locator('html'), 'a choice made is kept over the browser’s').toHaveAttribute('lang', 'en');
    });
  });

  test('has the switch on the account pages too, where the header is small', async ({ page }) => {
    await page.goto('/sign-in');

    await expect(page.getByTestId('language-es'), 'the switch is on the sign-in page').toBeVisible();
  });
});
