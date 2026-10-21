import { Locator, Page, expect } from '@playwright/test';

/** Page object for the History page: saved calculations, found by name. */
export class HistoryPage {
  readonly search: Locator;
  readonly empty: Locator;

  constructor(private readonly page: Page) {
    this.search = page.getByTestId('history-search');
    this.empty = page.getByTestId('history-empty');
  }

  /** Goes to History through the top navigation, as a user would. */
  async openFromNav(): Promise<void> {
    await this.page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name: 'Saved' }).click();
    await expect(this.page, 'the History page has its own URL').toHaveURL(/\/history$/);
  }

  /** Types into the search box and waits for the list to show `name`. */
  async searchFor(text: string): Promise<void> {
    await this.search.fill(text);
  }

  /** The list entry for a saved calculation, by its exact name. */
  item(name: string): Locator {
    return this.page.getByTestId('history-item').filter({ has: this.page.getByRole('heading', { name, exact: true }) });
  }

  /** Clicks one of an entry's buttons: Open, Edit or Delete. */
  act(name: string, action: 'Open' | 'Edit' | 'Delete'): Promise<void> {
    return this.item(name).getByRole('button', { name: `${action} ${name}` }).click();
  }

  /** Renames an entry in place. */
  async rename(from: string, to: string): Promise<void> {
    await this.act(from, 'Edit');
    await this.page.getByRole('textbox', { name: `New name for ${from}` }).fill(to);
    await this.page.getByRole('button', { name: 'Save', exact: true }).click();
  }

  /** Deletes an entry, confirming when asked. */
  async delete(name: string): Promise<void> {
    await this.act(name, 'Delete');
    await this.item(name).getByRole('button', { name: 'Yes, delete' }).click();
  }
}
