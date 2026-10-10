import { test as base } from '@playwright/test';
import { CalculatorPage } from './calculator.page';

/**
 * Playwright fixtures: each test receives a ready calculator page (opened, first result rendered),
 * instead of sharing a mutable variable set up in beforeEach.
 */
export const test = base.extend<{ calculator: CalculatorPage }>({
  calculator: async ({ page }, use) => {
    const calculator = new CalculatorPage(page);
    await calculator.open();
    await use(calculator);
  },
});

export { expect } from '@playwright/test';
