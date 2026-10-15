import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Automated accessibility checks with axe-core: every page and result view, against WCAG 2.2 A and AA, in light and
 * dark mode, on desktop and a phone. A failure lists each rule broken and the elements that break it.
 *
 * Automated checks find about a third of real problems (contrast, names, roles, structure); keyboard use and
 * screen-reader wording still need a person. Other specs cover the keyboard paths that matter (the tabs, the forms).
 */

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** The page's violations, one line each: "color-contrast (serious): .hint, .label". */
async function violations(page: Page): Promise<string[]> {
  // Charts are canvases with their own text alternatives (a takeaway and a data table), so their pixels are skipped.
  const results = await new AxeBuilder({ page }).withTags(WCAG).exclude('canvas').analyze();
  return results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).slice(0, 5).join(', ')}`);
}

/** Opens a view of buying a home by its link; the views under Cost are reached through Cost, one step down. */
async function openView(page: Page, id: string) {
  const link = page.getByTestId(`result-tab-${id}`);
  if (!(await link.isVisible())) await page.getByTestId('result-tab-overview').click();
  await link.click();
}

/** Waits until a calculator page shows its first results, so the scan sees the finished page (the start page has none). */
async function settled(page: Page) {
  // The start page and the reading pages have no results to wait for: their heading is the finished page.
  if (['/', '/how-it-works', '/glossary', '/privacy'].includes(new URL(page.url()).pathname)) {
    await expect(page.locator('main h2').first(), 'the page has arrived').toBeVisible();
    return;
  }
  await expect(page.getByTestId('results'), 'the results have arrived').toHaveAttribute('aria-busy', 'false');
}

/** Opens every collapsible form section, so the fields inside are scanned too. */
async function openSections(page: Page) {
  for (const section of await page.locator('details').all()) await section.evaluate((el) => ((el as HTMLDetailsElement).open = true));
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`Accessibility, ${scheme} mode`, () => {
    test.use({ colorScheme: scheme });
    // Each test scans the whole page several times (nine in the calculator's), which takes most of the default 30
    // seconds alone; with the suite running in parallel it can take longer. A slow test has three times as long.
    test.slow();

    test('the calculator: every results tab, and every form section open', async ({ page }) => {
      await page.goto('/calculator/overview');
      await settled(page);
      await openSections(page);
      expect(await violations(page), 'the Overview tab and the open form break no accessibility rule').toEqual([]);

      for (const tab of ['affordability', 'closing', 'rent-or-buy', 'projection', 'schedule'] as const) {
        await openView(page, tab);
        await settled(page);
        expect(await violations(page), `the ${tab} tab breaks no accessibility rule`).toEqual([]);
      }
      // Compare homes, and its second form, in the same place as the first.
      await page.getByTestId('result-tab-compare').click();
      await settled(page);
      expect(await violations(page), 'Compare homes breaks no accessibility rule').toEqual([]);
      await page.getByTestId('edit-home-b').check();
      await settled(page);
      expect(await violations(page), "Home B's form breaks no accessibility rule").toEqual([]);
      // Four homes: the widest table, and the switch with Remove.
      await page.getByTestId('add-home').click();
      await page.getByTestId('add-home').click();
      await expect(page.getByTestId('loan-heading'), 'the form edits Home D').toHaveText('Home D');
      await settled(page);
      expect(await violations(page), 'four homes side by side break no accessibility rule').toEqual([]);
    });

    test('the calculator with a buydown, then an adjustable rate: each rate plan', async ({ page }) => {
      await page.goto('/calculator/overview');
      await settled(page);
      await openSections(page);
      await page.getByTestId('rate-type-buydown').check();
      await expect(page.getByTestId('buydown-years'), 'the buydown table has arrived').toBeVisible();
      await settled(page);
      // With an income the Overview answers whether the home is affordable; the seller pays for the buydown, so the
      // Closing tab weighs the other ways to take that money.
      await page.getByTestId('annual-income').fill('150000');
      await settled(page);
      await expect(page.getByTestId('afford-tile-answer'), 'the Overview answers whether it is affordable').toBeVisible();
      expect(await violations(page), 'the buydown, year by year, breaks no accessibility rule').toEqual([]);
      await openView(page, 'closing');
      await expect(page.getByTestId('seller-offer'), 'the ways to take the seller’s money').toBeVisible();
      expect(await violations(page), 'the cash to close and the seller’s money each way break no accessibility rule').toEqual([]);
      await openView(page, 'affordability');
      await expect(page.getByTestId('affordability'), 'whether it is affordable').toBeVisible();
      expect(await violations(page), 'affordability breaks no accessibility rule').toEqual([]);
      await openView(page, 'rent-or-buy');
      await page.getByTestId('monthly-rent').fill('2400');
      await expect(page.getByTestId('rent-or-buy-verdict'), 'buying against renting').toBeVisible();
      await settled(page);
      expect(await violations(page), 'rent or buy breaks no accessibility rule').toEqual([]);

      await page.getByTestId('result-tab-overview').click();
      await page.getByTestId('rate-type-arm').check();
      await expect(page.getByTestId('arm-worst-case'), 'the adjustable rate plan has arrived').toBeVisible();
      await settled(page);
      expect(await violations(page), 'the adjustable rate plan breaks no accessibility rule').toEqual([]);
    });

    test('refinance', async ({ page }) => {
      await page.goto('/refinance');
      await settled(page);
      await openSections(page);

      expect(await violations(page), 'Refinance, every section open, breaks no accessibility rule').toEqual([]);
    });

    test('pay off or invest: every results tab', async ({ page }) => {
      await page.goto('/strategy');
      await settled(page);
      await openSections(page);
      expect(await violations(page), 'the Over time tab and the open form break no accessibility rule').toEqual([]);

      for (const tab of ['Milestones', 'Debt vs. investments', 'Why']) {
        await page.getByRole('tab', { name: tab }).click();
        expect(await violations(page), `the ${tab} tab breaks no accessibility rule`).toEqual([]);
      }
    });

    test('the account pages', async ({ page }) => {
      for (const path of ['/sign-in', '/forgot-password', '/dev/mailbox']) {
        await page.goto(path);
        await expect(page.locator('main'), `${path} has loaded`).toBeVisible();
        expect(await violations(page), `${path} breaks no accessibility rule`).toEqual([]);
      }
    });

    test('the account page, with the delete step open', async ({ account, page }) => {
      expect(account.email, 'signed in').toBeTruthy();
      await page.goto('/account');
      await page.getByTestId('delete-start').click();
      await page.getByTestId('delete-submit').click();
      await expect(page.getByTestId('delete-form').locator('.error'), 'the empty password is flagged').toBeVisible();

      expect(await violations(page), 'the account page breaks no accessibility rule').toEqual([]);
    });

    test('history, signed in, with a saved calculation', async ({ signedIn, page }) => {
      await signedIn.saveAs('Oak St');
      await page.goto('/history');
      await expect(page.getByTestId('history-item'), 'the saved calculation is listed').toHaveCount(1);

      expect(await violations(page), 'History breaks no accessibility rule').toEqual([]);
    });
  });
}

test.describe('Accessibility on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const path of ['/', '/calculator/overview', '/refinance', '/strategy', '/how-it-works', '/glossary', '/privacy']) {
    test(`${path}`, async ({ page }) => {
      await page.goto(path);
      await settled(page);

      expect(await violations(page), `${path} breaks no accessibility rule on a phone`).toEqual([]);
    });
  }

  test('the calculator with a buydown', async ({ page }) => {
    await page.goto('/calculator/overview');
    await settled(page);
    // The form is a sheet on a phone: open it, as a visitor would, to choose the rate type.
    await page.getByTestId('edit-inputs').click();
    await openSections(page);
    await page.getByTestId('rate-type-buydown').check();
    await page.getByTestId('close-sheet').click();
    await expect(page.getByTestId('buydown-years'), 'the buydown table has arrived').toBeVisible();
    await settled(page);

    expect(await violations(page), 'the buydown table breaks no accessibility rule on a phone').toEqual([]);
  });
});
