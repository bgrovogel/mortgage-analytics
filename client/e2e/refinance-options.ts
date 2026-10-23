import { expect, type Page } from '@playwright/test';

/** Opens the form's section of other ways to compare (points, a debt, borrowing the cash), which starts closed. */
export async function openOtherWays(page: Page): Promise<void> {
  await page.getByTestId('section-compare-ways').evaluate((el) => ((el as HTMLDetailsElement).open = true));
}

/**
 * Opens every way listed under "Your options" in the results, once `count` of them have arrived: with more than one, each starts
 * closed, its answer a line.
 */
export async function openOptions(page: Page, count: number): Promise<void> {
  const options = page.locator('[data-testid="refi-options"] details');
  await expect(options, `${count} ways are listed`).toHaveCount(count);
  for (const option of await options.all()) {
    await option.evaluate((el) => ((el as HTMLDetailsElement).open = true));
  }
}
