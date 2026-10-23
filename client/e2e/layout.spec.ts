import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { openOptions, openOtherWays } from './refinance-options';

/**
 * Layout rules that hold on every page at every size, checked in the real browser. They are the bugs a screenshot
 * comparison would catch, written as what must be true instead, so there are no baseline images to keep in step
 * across operating systems: nothing scrolls the page sideways, no table is cut off at its edge, no word is clipped, no
 * number is "NaN", the page has one heading, and (on a phone) what is pressed is big enough to press.
 */

const PAGES = [
  '/', '/calculator/overview', '/calculator/affordability', '/calculator/closing', '/calculator/rent-or-buy', '/calculator/projection',
  '/calculator/sale', '/calculator/rental', '/calculator/schedule', '/compare', '/refinance', '/strategy', '/how-it-works', '/glossary', '/privacy', '/terms', '/sign-in',
  '/forgot-password', '/no-such-page',
];

const SIZES = [
  { name: 'a desktop', viewport: { width: 1440, height: 900 }, phone: false },
  { name: 'a tablet', viewport: { width: 820, height: 1100 }, phone: false },
  { name: 'a phone', viewport: { width: 390, height: 844 }, phone: true },
];

/** The tables that are meant to scroll sideways on a small screen, because they are a ledger of many columns. */
const SCROLLING_TABLES = ['schedule-table'];

/** What is wrong with the page as it stands, one line each; empty when nothing is. */
async function layoutProblems(page: Page, phone: boolean): Promise<string[]> {
  return page.evaluate(({ phone, scrolling }) => {
    const found: string[] = [];
    const root = document.documentElement;
    if (root.scrollWidth > root.clientWidth + 1) found.push(`the page scrolls sideways: ${root.scrollWidth}px in a ${root.clientWidth}px window`);

    for (const table of document.querySelectorAll('table')) {
      const box = table.getBoundingClientRect();
      if (box.width === 0) continue;
      let wrap: HTMLElement | null = table.parentElement;
      while (wrap && wrap !== document.body && getComputedStyle(wrap).overflowX === 'visible') wrap = wrap.parentElement;
      const shown = wrap?.clientWidth ?? root.clientWidth;
      const name = table.getAttribute('data-testid') ?? table.closest('[data-testid]')?.getAttribute('data-testid') ?? 'a table';
      if (table.scrollWidth > shown + 1 && !scrolling.includes(name)) found.push(`the table "${name}" is ${table.scrollWidth}px in ${shown}px, so its right side is cut off`);
    }

    const clipped = [...document.querySelectorAll('button, a, h1, h2, h3, label, th, td, li, p, span')].filter((el) => {
      const style = getComputedStyle(el);
      return el.getBoundingClientRect().width > 0 && style.overflow === 'hidden' && style.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1;
    });
    for (const el of clipped.slice(0, 3)) found.push(`text is cut off with an ellipsis: "${(el.textContent ?? '').trim().slice(0, 40)}"`);

    const badText = ['NaN', 'Infinity', 'undefined', '[object', 'null%'].filter((word) => document.body.innerText.includes(word));
    if (badText.length > 0) found.push(`the page shows ${badText.join(', ')}`);

    const headings = document.querySelectorAll('h1').length;
    if (headings !== 1) found.push(`${headings} h1 headings, not one`);

    if (phone) {
      const small = [...document.querySelectorAll('button, a[href], select, [role=tab]')].filter((el) => {
        const box = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        const inText = el.closest('p, li, small, .hint, footer, .links, .skip-link, nav.footer-links') !== null;
        return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && box.height < 40 && !inText && !el.classList.contains('skip-link');
      });
      for (const el of small.slice(0, 4)) found.push(`a target under 40px tall on a phone: ${el.tagName.toLowerCase()} "${(el.getAttribute('data-testid') ?? el.textContent ?? '').trim().slice(0, 30)}"`);
    }
    return found;
  }, { phone, scrolling: SCROLLING_TABLES });
}

for (const { name, viewport, phone } of SIZES) {
  test.describe(`The layout on ${name}`, () => {
    test.use({ viewport });

    for (const path of PAGES) {
      test(`${path} breaks no layout rule`, async ({ page }) => {
        await page.goto(path);
        // A page with results waits for them; the others, for their heading.
        const results = page.getByTestId('results');
        if (await results.count()) await expect(results, 'the results have arrived').toHaveAttribute('aria-busy', 'false');
        await expect(page.locator('main h1').first(), 'the page has arrived').toBeVisible();

        expect(await layoutProblems(page, phone), `${path} on ${name}`).toEqual([]);
      });
    }

    test('/refinance with a home-equity line compared breaks no layout rule', async ({ page }) => {
      await page.goto('/refinance');
      await expect(page.getByTestId('results'), 'the results have arrived').toHaveAttribute('aria-busy', 'false');
      // Up to 860px the form is a sheet that opens from the results, with the new loan one step in.
      const sheet = viewport.width <= 860;
      if (sheet) {
        await page.getByTestId('edit-inputs').click();
        await page.getByTestId('refi-next').click();
      }
      await page.getByTestId('section-new-extras').locator('summary').click();
      await page.getByTestId('cash-out').fill('50000');
      await openOtherWays(page);
      await page.getByTestId('compare-equity-loan').check();
      await page.getByTestId('equity-kind-line').check(); // the line asks for the most: two more fields, and a note
      await page.getByTestId('pay-off-debt').check(); // and a debt, with four fields and a table
      await page.getByTestId('buy-points').check(); // and the points, with their own fields and table
      if (sheet) await page.getByTestId('close-sheet').click();
      await expect(page.getByTestId('refi-home-equity'), 'the home-equity comparison has arrived').toBeVisible();
      await openOptions(page, 3); // with three ways listed, each starts closed
      await expect(page.getByTestId('refi-equity-line-note'), 'as a line of credit').toBeVisible();
      await expect(page.getByTestId('refi-points'), 'with points bought').toBeVisible();
      await expect(page.getByTestId('refi-debt'), 'and a debt paid off').toBeVisible();

      expect(await layoutProblems(page, phone), `/refinance with a home-equity line on ${name}`).toEqual([]);
    });
  });
}

/**
 * The year tables of the sale, rent-or-buy and rental views sit straight on the page, and their first column stays put while
 * a narrow screen scrolls the figures. That column must be the page's colour, or it shows as a white strip down a grey page.
 */
test.describe('The year tables', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const { tab, table, rent } of [
    { tab: 'sale', table: 'sale-table', rent: null },
    { tab: 'rent-or-buy', table: 'rent-or-buy', rent: 'monthly-rent' },
    { tab: 'rental', table: 'rental-table', rent: 'rental-rent' },
  ]) {
    test(`the ${table} table keeps its first column the colour of the page`, async ({ page }) => {
      await page.goto(`/calculator/${tab}`);
      await expect(page.getByTestId('results'), 'the results have arrived').toHaveAttribute('aria-busy', 'false');
      if (rent) await page.getByTestId(rent).fill('2800');

      const first = page.getByTestId(table).locator('tbody th').first();
      await expect(first, 'the table is shown').toBeVisible();
      const colours = await first.evaluate((el) => ({ column: getComputedStyle(el).backgroundColor, page: getComputedStyle(document.body).backgroundColor }));
      expect(colours.column, 'the first column is the page colour').toBe(colours.page);
    });
  }
});
