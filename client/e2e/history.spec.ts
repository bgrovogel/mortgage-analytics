import { API_URL } from './env';
import { expect, test } from './fixtures';
import { HistoryPage } from './history.page';

/**
 * Saving, finding, reopening, renaming and deleting calculations, against the real API and database.
 * Each test saves under names carrying its own tag, and deletes whatever it saved afterwards.
 */
test.describe('History', () => {
  let tag: string;

  test.beforeEach(() => {
    tag = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  });

  test.afterEach(async ({ request }) => {
    const leftovers = await (await request.get(`${API_URL}/api/v1/calculations`, { params: { search: tag } })).json();
    for (const calculation of leftovers as { id: string }[]) {
      await request.delete(`${API_URL}/api/v1/calculations/${calculation.id}`);
    }
  });

  test('saves a calculation under a name, finds it again, and reopens it with every value', async ({ calculator, page }) => {
    const name = `Oak St ${tag}`;
    await calculator.set('home-price', 432_100);
    await calculator.set('monthly-extra', 350);
    await calculator.calculate();
    await calculator.saveAs(name);

    // Start from a clean slate, so reopening has to restore the values.
    await page.goto('/');
    await expect(calculator.field('home-price'), 'a fresh visit starts from the example').toHaveValue('375,000');

    const history = new HistoryPage(page);
    await history.openFromNav();
    await history.searchFor(tag);
    await expect(history.item(name), 'the saved calculation is listed').toBeVisible();
    await expect(history.item(name), 'with a summary of its loan').toContainText('$432,100 home');

    await history.act(name, 'Open');

    await expect(page, 'opening goes to the calculator').toHaveURL(/\/calculator\/overview$/);
    await expect(calculator.field('home-price'), 'the saved price is back').toHaveValue('432,100');
    await expect(calculator.field('monthly-extra'), 'and the saved extra payment').toHaveValue('350');
    await page.getByTestId('save-open').click();
    await expect(page.getByTestId('save-update'), 'saving again offers to update the one it came from').toContainText(name);
  });

  test('renames and deletes a saved calculation', async ({ calculator, page }) => {
    const name = `Maple ${tag}`;
    const renamed = `Maple final ${tag}`;
    await calculator.saveAs(name);

    const history = new HistoryPage(page);
    await history.openFromNav();
    await history.searchFor(tag);
    await history.rename(name, renamed);
    await expect(history.item(renamed), 'the new name is shown').toBeVisible();

    await history.delete(renamed);

    await expect(history.item(renamed), 'it is gone from the list').toHaveCount(0);
    await expect(history.empty, 'and nothing else matches the search').toContainText('Nothing matches');
  });

  test('saves a refinance comparison and reopens it on the Refinance page', async ({ page }) => {
    const name = `Refi ${tag}`;
    await page.goto('/refinance');
    await page.getByTestId('new-rate').fill('5.5');
    await expect(page.getByTestId('refi-verdict'), 'the comparison updates').toContainText('Refinancing');
    await page.getByTestId('save-open').click();
    await page.getByTestId('save-name').fill(name);
    await page.getByTestId('save-new').click();
    await expect(page.getByTestId('save-status'), 'the save is confirmed').toContainText(`Saved as “${name}”`);

    await page.goto('/refinance'); // a reload starts over from the worked example
    const history = new HistoryPage(page);
    await history.openFromNav();
    await history.searchFor(tag);
    await expect(history.item(name), 'it is listed as a refinance comparison').toContainText('Refinance');
    await expect(history.item(name), 'with a summary of the refinance').toContainText('→ 5.5%');

    await history.act(name, 'Open');

    await expect(page, 'it opens on the Refinance page').toHaveURL(/\/refinance$/);
    await expect(page.getByTestId('new-rate'), 'with the saved rate').toHaveValue('5.5');
  });
});
