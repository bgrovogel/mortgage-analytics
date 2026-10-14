// Retakes the screenshots in docs/images from the running app, so they can follow the UI as it changes.
// Needs the dev servers: the API on :5080 and `npm start` on :4200. Run from client/: `npm run screenshots`.
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const app = process.env.APP_URL ?? 'http://localhost:4200';
const images = fileURLToPath(new URL('../../docs/images/', import.meta.url));
const desktop = { width: 1440, height: 900 };
const phone = { width: 390, height: 844 };

/** Opens a page and waits for its first results, so no screenshot catches it mid-update. */
async function open(browser, path, { viewport = desktop, scale = 1, scheme = 'light' } = {}) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: scale, colorScheme: scheme });
  await page.goto(`${app}${path}`);
  await page.getByTestId('results').and(page.locator('[aria-busy="false"]')).waitFor();
  return page;
}

/** Waits for the results to settle again after a change. */
async function settled(page) {
  await page.waitForTimeout(600); // the debounce before the request
  await page.getByTestId('results').and(page.locator('[aria-busy="false"]')).waitFor();
}

const shots = {
  'calculator.png': async (b) => open(b, '/calculator/overview', { scale: 2 }),
  'projection.png': async (b) => open(b, '/calculator/projection'),
  'schedule.png': async (b) => open(b, '/calculator/schedule'),
  // Three homes: the example, a $450,000 home with 20% down, and a $380,000 home with the same $37,350 down.
  'compare.png': async (b) => {
    const page = await open(b, '/calculator/compare');
    await page.getByTestId('edit-home-b').check();
    await settled(page); // Home B's form fills in before it can be changed
    await page.getByTestId('home-price').fill('450000');
    await page.getByTestId('down-payment').fill('90000');
    await page.getByTestId('add-home').click();
    await page.getByTestId('loan-heading').filter({ hasText: 'Home C' }).waitFor(); // the new home's form, before typing
    await page.getByTestId('home-price').fill('380000');
    await page.getByTestId('home-price').blur(); // formatted, as it shows once typed
    await page.mouse.move(0, 0);
    await settled(page);
    return page;
  },
  // Just the cash to close: a builder's 2-1 buydown and $8,000 of credits, more than 3% of the price allows.
  'concessions.png': async (b) => {
    const page = await open(b, '/calculator/overview', { scale: 2 });
    await page.getByText('Closing costs').first().click();
    await page.getByTestId('closing-credits').fill('8000');
    await page.getByText('Rate type').first().click();
    await page.getByTestId('rate-type-buydown').check();
    await settled(page);
    return page.locator('app-cash-to-close');
  },
  // Just the seller's $8,000 four ways: off the price, toward closing, a 2-1 buydown, points.
  'seller-offer.png': async (b) => {
    const page = await open(b, '/calculator/overview', { scale: 2 });
    await page.getByText('Closing costs').first().click();
    await page.getByTestId('closing-credits').fill('8000');
    await settled(page);
    return page.locator('app-seller-offer');
  },
  'refinance.png': async (b) => open(b, '/refinance'),
  'pay-off-or-invest-dark.png': async (b) => open(b, '/strategy', { scheme: 'dark' }),
  'phone.png': async (b) => open(b, '/calculator/overview', { viewport: phone, scale: 2 }),
  // Just the rate plan: a 2-1 buydown, year by year.
  'buydown.png': async (b) => {
    const page = await open(b, '/calculator/overview', { scale: 2 });
    await page.getByText('Rate type').first().click();
    await page.getByTestId('rate-type-buydown').check();
    await settled(page);
    return page.getByTestId('rate-plan');
  },
};

const browser = await chromium.launch();
try {
  for (const [file, take] of Object.entries(shots)) {
    const target = await take(browser);
    await target.screenshot({ path: `${images}${file}` });
    console.log(`docs/images/${file}`);
    await ('page' in target ? target.page() : target).close();
  }
} finally {
  await browser.close();
}
