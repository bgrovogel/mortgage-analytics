import { expect, test } from './fixtures';
import { HistoryPage } from './history.page';

/**
 * Saving, finding, reopening, renaming and deleting calculations, against the real API and database.
 * Each test runs as a brand-new user (the `signedIn` / `account` fixtures), so its History holds only
 * what it saved; names still carry a tag, so searches are unambiguous.
 */
test.describe('History', () => {
  let tag: string;

  test.beforeEach(() => {
    tag = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  });

  test('sets two saved purchases side by side, with the payment each comes to', async ({ signedIn: calculator, page }) => {
    const first = `Oak St ${tag}`;
    const second = `Elm Ct ${tag}`;
    await calculator.set('home-price', 400_000);
    await calculator.set('down-payment', 80_000);
    await calculator.calculate();
    await calculator.saveAs(first);
    await calculator.set('home-price', 450_000);
    await calculator.set('down-payment', 90_000);
    await calculator.calculate();
    await calculator.saveAs(second);

    const history = new HistoryPage(page);
    await history.openFromNav();
    await history.searchFor(tag);
    const picks = page.locator('[data-testid^="pick-"]');
    await expect(picks, 'each purchase can be picked').toHaveCount(2);
    await picks.nth(0).check();
    await picks.nth(1).check();

    const pair = page.getByTestId('saved-pair');
    await expect(pair, 'two picked are set side by side').toBeVisible();
    await expect(pair.getByRole('row', { name: /Home price/ }), 'with the price of each and the difference').toContainText(/[+−]\$50,000/);
    await expect(pair.getByRole('row', { name: /Principal and interest/ }), 'and the payment each comes to').toContainText('$');
  });

  test('saves a calculation under a name, finds it again, and reopens it with every value', async ({ signedIn: calculator, page }) => {
    const name = `Oak St ${tag}`;
    await calculator.set('home-price', 432_100);
    await calculator.set('monthly-extra', 350);
    await calculator.calculate();
    await calculator.saveAs(name);

    // Start from a clean slate, so reopening has to restore the values.
    await page.goto('/calculator');
    await expect(calculator.field('home-price'), 'a fresh visit starts from the example').toHaveValue('415,000');

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

  test('renames and deletes a saved calculation', async ({ signedIn: calculator, page }) => {
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

  test('saves a refinance comparison and reopens it on the Refinance page', async ({ account, page }) => {
    expect(account.email, 'signed in').toBeTruthy();
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

  test('saves a pay-off-or-invest comparison and reopens it with every setting', async ({ account, page }) => {
    expect(account.email, 'signed in').toBeTruthy();
    const name = `Pay off ${tag}`;
    await page.goto('/strategy');
    await page.getByTestId('monthly-cash').fill('2500');
    await page.getByTestId('risk-Conservative').check();
    await page.getByTestId('section-stock').locator('summary').click();
    await page.getByTestId('rsu').fill('20000');
    await expect(page.getByTestId('results'), 'the comparison has caught up').toHaveAttribute('aria-busy', 'false');
    await page.getByTestId('save-open').click();
    await page.getByTestId('save-name').fill(name);
    await page.getByTestId('save-new').click();
    await expect(page.getByTestId('save-status'), 'the save is confirmed').toContainText(`Saved as “${name}”`);

    await page.goto('/strategy'); // a reload starts over from the defaults
    await expect(page.getByTestId('monthly-cash'), 'the reload really did start over').toHaveValue('1,000');
    const history = new HistoryPage(page);
    await history.openFromNav();
    await history.searchFor(tag);
    await expect(history.item(name), 'it is listed as a pay-off-or-invest comparison').toContainText('Pay off or invest');
    await expect(history.item(name), 'with a summary of the comparison').toContainText('$2,500/mo to put to work · Conservative');

    await history.act(name, 'Open');

    await expect(page, 'it opens on the Pay off or invest page').toHaveURL(/\/strategy$/);
    await expect(page.getByTestId('monthly-cash'), 'with the saved cash').toHaveValue('2,500');
    await expect(page.getByTestId('risk-Conservative'), 'the saved risk profile').toBeChecked();
    await expect(page.getByTestId('rsu'), 'and the saved RSUs').toHaveValue('20,000');
    await expect(page.getByTestId('save-open'), 'Save can now update it in place').toBeEnabled();
  });

  test('saves three homes compared, and reopens them all on Compare homes', async ({ signedIn: calculator, page }) => {
    const name = `Oak, Elm or Ash ${tag}`;
    await calculator.compareHomes();
    await calculator.editHome('B');
    await calculator.set('home-price', 450_000);
    await calculator.addHome('C');
    await calculator.set('home-price', 380_000);
    await calculator.calculate();
    await calculator.saveAs(name);

    await page.goto('/calculator');
    const history = new HistoryPage(page);
    await history.openFromNav();
    await history.searchFor(tag);
    await expect(history.item(name), 'it is listed as a comparison of homes').toContainText('Compare homes');
    await expect(history.item(name), 'with every home summed up').toContainText('vs $450,000 home, 8.3% down at 6.25% vs $380,000 home');

    await history.act(name, 'Open');

    await expect(page, 'it opens on Compare homes').toHaveURL(/\/compare$/);
    await expect(calculator.field('home-price'), 'Home A is in the form').toHaveValue('415,000');
    await calculator.editHome('B');
    await expect(calculator.field('home-price'), 'and Home B is kept beside it').toHaveValue('450,000');
    await calculator.editHome('C');
    await expect(calculator.field('home-price'), 'and Home C').toHaveValue('380,000');
  });

  test('fits a phone: five filters wrap rather than push the page sideways', async ({ signedIn: calculator, page }) => {
    await calculator.saveAs(`Phone ${tag}`);
    await page.setViewportSize({ width: 390, height: 844 });

    await new HistoryPage(page).openFromNav();

    await expect(page.getByRole('heading', { name: 'Saved calculations' }), 'the list is open').toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'the page does not scroll sideways').toBeLessThanOrEqual(0);
  });
});
