import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { ES } from '../src/app/core/i18n/es';
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

/**
 * Every page in Spanish: nothing left in English that the app wrote, nothing wider than the screen (Spanish runs longer),
 * and no accessibility rule broken. Brand and loan names (Mortgage Analytics, Loan Estimate, FHA) stay as they are.
 */
const PAGES = [
  '/', '/calculator/overview', '/calculator/affordability', '/calculator/closing', '/calculator/rent-or-buy', '/calculator/projection',
  '/calculator/sale', '/calculator/rental', '/calculator/schedule', '/compare', '/refinance', '/strategy', '/how-it-works', '/glossary', '/privacy', '/terms', '/sign-in',
];

/** Words that only English text has, found in the page's main content as whole words (letters with accents count as letters). */
const ENGLISH = /(?<!\p{L})(the|your|you|with|and|of|is|for|to|in|this|that|are|from|not|all|by|per|each|than)(?!\p{L})/iu;

/**
 * The app's own messages that read differently in Spanish. A word of one of these, shown as it is in English on a Spanish page,
 * was written by the app and never put through the translation: a single-word label has none of the words above to give it away.
 */
const ENGLISH_MESSAGES = Object.entries(ES).filter(([english, spanish]) => english !== spanish && !english.includes('{')).map(([english]) => english);

/** The texts in `main` (an element's own words, or its label, placeholder or title) that are exactly one of the English messages. */
async function untranslatedTexts(page: Page): Promise<string[]> {
  return page.locator('main').evaluate((main, english) => {
    const known = new Set(english);
    const found = new Set<string>();
    const note = (raw: string | null) => {
      const text = (raw ?? '').replace(/\s+/g, ' ').trim();
      if (known.has(text)) found.add(text);
    };
    for (const el of [main, ...main.querySelectorAll('*')]) {
      note([...el.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join(' '));
      for (const name of ['aria-label', 'placeholder', 'title']) note(el.getAttribute(name));
    }
    return [...found];
  }, ENGLISH_MESSAGES);
}

/** The lines of the page's main content that still hold an English word, other than the names that stay as they are, and any text left untranslated. */
async function englishLines(page: Page): Promise<string[]> {
  const text = await page.locator('main').innerText();
  const lines = text.split('\n').filter((line) => ENGLISH.test(line) && !/Loan Estimate|Mortgage Analytics|Fannie Mae|Save Our Homes/.test(line));
  return [...lines, ...(await untranslatedTexts(page))].slice(0, 6);
}

test.describe('Spanish, on every page', () => {
  test.use({ locale: 'es-MX', viewport: { width: 390, height: 844 } });
  test.slow();

  for (const path of PAGES) {
    test(`${path} is in Spanish, fits a phone, and breaks no accessibility rule`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('html'), 'the page is in Spanish').toHaveAttribute('lang', 'es');
      if (path.startsWith('/calculator') || ['/compare', '/refinance', '/strategy'].includes(path)) {
        await expect(page.getByTestId('results'), 'the results have arrived').toHaveAttribute('aria-busy', 'false');
      } else {
        await expect(page.locator('main h1').first(), 'the page has arrived').toBeVisible();
      }
      for (const section of await page.locator('details').all()) await section.evaluate((el) => ((el as HTMLDetailsElement).open = true));

      // The spoken answer is announced after a short pause, so it follows the switch a moment later: ask until it has.
      await expect.poll(() => englishLines(page), { message: 'no line of the page is left in English' }).toEqual([]);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, 'the page does not scroll sideways').toBeLessThanOrEqual(1);

      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      const broken = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 4).join(', ')}`);
      expect(broken, 'no accessibility rule is broken').toEqual([]);
    });
  }

  test('/refinance with a home-equity loan compared is in Spanish, fits a phone, and breaks no accessibility rule', async ({ page }) => {
    await page.goto('/refinance');
    await expect(page.getByTestId('results'), 'the results have arrived').toHaveAttribute('aria-busy', 'false');
    // On a phone the form is a sheet that opens from the results, with the new loan one step in.
    await page.getByTestId('edit-inputs').click();
    await page.getByTestId('refi-next').click();
    await page.getByTestId('section-new-extras').locator('summary').click();
    await page.getByTestId('cash-out').fill('50000');
    await page.getByTestId('compare-equity-loan').check();
    await page.getByTestId('close-sheet').click();
    await expect(page.getByTestId('refi-home-equity'), 'the home-equity comparison has arrived').toBeVisible();
    for (const section of await page.locator('details').all()) await section.evaluate((el) => ((el as HTMLDetailsElement).open = true));

    await expect.poll(() => englishLines(page), { message: 'no line of the page is left in English' }).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'the page does not scroll sideways').toBeLessThanOrEqual(1);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations.map((v) => v.id), 'no accessibility rule is broken').toEqual([]);
  });
});

/** The same check after switching with the page open: everything on it follows, not only what is drawn afresh. */
test.describe('Spanish, switched on the page', () => {
  test.use({ viewport: { width: 1200, height: 900 } });
  test.slow();

  for (const path of ['/calculator/overview', '/calculator/affordability', '/calculator/closing', '/calculator/rent-or-buy', '/calculator/projection', '/calculator/sale', '/calculator/rental', '/calculator/schedule', '/compare', '/refinance', '/strategy']) {
    test(`${path} follows the switch without a reload`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByTestId('results'), 'the results have arrived').toHaveAttribute('aria-busy', 'false');
      await page.getByTestId('language-es').click();
      await expect(page.locator('html'), 'the page is in Spanish').toHaveAttribute('lang', 'es');
      for (const section of await page.locator('details').all()) await section.evaluate((el) => ((el as HTMLDetailsElement).open = true));

      // The spoken answer is announced after a short pause, so it follows the switch a moment later: ask until it has.
      await expect.poll(() => englishLines(page), { message: 'no line of the page is left in English' }).toEqual([]);
    });
  }
});
