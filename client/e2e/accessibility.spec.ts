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

/** Waits until a calculator page shows its first results, so the scan sees the finished page. */
async function settled(page: Page) {
  await expect(page.getByTestId('results'), 'the results have arrived').toHaveAttribute('aria-busy', 'false');
}

/** Opens every collapsible form section, so the fields inside are scanned too. */
async function openSections(page: Page) {
  for (const section of await page.locator('details').all()) await section.evaluate((el) => ((el as HTMLDetailsElement).open = true));
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`Accessibility, ${scheme} mode`, () => {
    test.use({ colorScheme: scheme });

    test('the calculator: every results tab, and every form section open', async ({ page }) => {
      await page.goto('/calculator/overview');
      await settled(page);
      await openSections(page);
      expect(await violations(page), 'the Overview tab and the open form break no accessibility rule').toEqual([]);

      for (const tab of ['projection', 'schedule', 'compare'] as const) {
        await page.getByTestId(`result-tab-${tab}`).click();
        await settled(page);
        expect(await violations(page), `the ${tab} tab breaks no accessibility rule`).toEqual([]);
      }
      // The Compare tab's second form, in the same place as the first.
      await page.getByTestId('edit-home-b').check();
      await settled(page);
      expect(await violations(page), "Home B's form breaks no accessibility rule").toEqual([]);
    });

    test('the calculator with a buydown, then an adjustable rate: each rate plan', async ({ page }) => {
      await page.goto('/calculator/overview');
      await settled(page);
      await openSections(page);
      await page.getByTestId('rate-type-buydown').check();
      await expect(page.getByTestId('buydown-years'), 'the buydown table has arrived').toBeVisible();
      await settled(page);
      // The seller pays for the buydown, so the Overview also weighs the other ways to take that money.
      await expect(page.getByTestId('seller-offer'), 'the ways to take the seller’s money have arrived').toBeVisible();
      expect(await violations(page), 'the buydown, year by year, and the seller’s money each way break no accessibility rule').toEqual([]);

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

  for (const path of ['/calculator/overview', '/refinance', '/strategy']) {
    test(`${path}`, async ({ page }) => {
      await page.goto(path);
      await settled(page);

      expect(await violations(page), `${path} breaks no accessibility rule on a phone`).toEqual([]);
    });
  }

  test('the calculator with a buydown', async ({ page }) => {
    await page.goto('/calculator/overview');
    await settled(page);
    await openSections(page);
    await page.getByTestId('rate-type-buydown').check();
    await expect(page.getByTestId('buydown-years'), 'the buydown table has arrived').toBeVisible();
    await settled(page);

    expect(await violations(page), 'the buydown table breaks no accessibility rule on a phone').toEqual([]);
  });
});
