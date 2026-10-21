import { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * How far, in pixels, each moving dot is from the line it marks: the dot is a span laid over the drawing, so any
 * change to the box around the drawing (a tooltip that becomes a card under it on a phone, say) would move the dots off
 * their lines. Measured from the drawing itself: the point of each line at the scrubber's position, on the screen.
 */
async function dotOffsets(page: Page, svgSelector: string, lineSelectors: string[]): Promise<{ dx: number; dy: number }[]> {
  return page.evaluate(({ svgSelector, lineSelectors }) => {
    const svg = document.querySelector(svgSelector) as SVGSVGElement;
    const cursorX = Number(svg.querySelector('line.cursor')!.getAttribute('x1'));
    const dots = [...svg.parentElement!.querySelectorAll('.dot')];
    const screen = svg.getScreenCTM()!;
    // The lines in the order of the dots, which follow the series.
    return lineSelectors.flatMap((selector) => [...svg.querySelectorAll<SVGPathElement>(selector)]).map((line, i) => {
      // The point of the line at the cursor's x, found by halving.
      let low = 0;
      let high = line.getTotalLength();
      for (let step = 0; step < 40; step++) {
        const middle = (low + high) / 2;
        if (line.getPointAtLength(middle).x < cursorX) low = middle;
        else high = middle;
      }
      const point = line.getPointAtLength(low);
      const box = dots[i].getBoundingClientRect();
      return { dx: box.left + box.width / 2 - (point.x * screen.a + screen.e), dy: box.top + box.height / 2 - (point.y * screen.d + screen.f) };
    });
  }, { svgSelector, lineSelectors });
}

const SIZES = [
  { name: 'a desktop', viewport: { width: 1440, height: 900 } },
  { name: 'a phone', viewport: { width: 390, height: 844 } },
];

for (const { name, viewport } of SIZES) {
  test.describe(`On ${name}`, () => {
    test.use({ viewport });

    test('the balance chart\'s dots sit on its lines', async ({ calculator, page }) => {
      await expect(calculator.headline, 'the page has loaded').toBeVisible();
      await page.getByTestId('balance-chart').scrollIntoViewIfNeeded();

      const offsets = await dotOffsets(page, 'svg[data-testid="balance-chart"]', ['path.extra', 'path.scheduled']);

      expect(offsets, 'a dot for each line').toHaveLength(2);
      for (const { dx, dy } of offsets) {
        expect(Math.abs(dx), 'across, the dot is on the cursor').toBeLessThan(1.5);
        expect(Math.abs(dy), 'up and down, the dot is on the line').toBeLessThan(1.5);
      }
    });

    test('the pay-off-or-invest chart\'s dots sit on its lines', async ({ page }) => {
      await page.goto('/strategy');
      await expect(page.locator('app-scrub-chart svg').first(), 'the chart is drawn').toBeVisible();

      const offsets = await dotOffsets(page, 'app-scrub-chart svg', ['path.line']);

      expect(offsets.length, 'a dot for each line').toBeGreaterThan(1);
      for (const { dx, dy } of offsets) {
        expect(Math.abs(dx), 'across, the dot is on the cursor').toBeLessThan(1.5);
        expect(Math.abs(dy), 'up and down, the dot is on the line').toBeLessThan(1.5);
      }
    });

    test('the rent-or-buy chart dots sit on its line', async ({ calculator, page }) => {
      await calculator.showResults('rent-or-buy');
      await calculator.set('monthly-rent', 2_400);
      await calculator.calculate();
      await expect(page.getByTestId('rent-or-buy-chart'), 'the chart is drawn').toBeVisible();

      const offsets = await dotOffsets(page, 'svg[data-testid="rent-or-buy-chart"]', ['path.line']);

      expect(offsets, 'a dot for its line').toHaveLength(1);
      expect(Math.abs(offsets[0].dx), 'across, the dot is on the cursor').toBeLessThan(1.5);
      expect(Math.abs(offsets[0].dy), 'up and down, the dot is on the line').toBeLessThan(1.5);
    });

    test('the refinance chart dots sit on its lines', async ({ page }) => {
      await page.goto('/refinance');
      await page.getByTestId('tab-time').click();
      await expect(page.getByTestId('refi-chart'), 'the chart is drawn').toBeVisible();

      const offsets = await dotOffsets(page, 'svg[data-testid="refi-chart"]', ['path.line']);

      expect(offsets.length, 'a dot for each line').toBeGreaterThan(1);
      for (const { dx, dy } of offsets) {
        expect(Math.abs(dx), 'across, the dot is on the cursor').toBeLessThan(1.5);
        expect(Math.abs(dy), 'up and down, the dot is on the line').toBeLessThan(1.5);
      }
    });

    test('the projection chart\'s dots sit on its lines', async ({ calculator, page }) => {
      await calculator.showResults('projection');
      await expect(page.getByTestId('projection-chart-costs'), 'the chart is drawn').toBeVisible();

      const offsets = await dotOffsets(page, 'svg[data-testid="projection-chart-costs"]', ['path.line']);

      expect(offsets.length, 'a dot for each line').toBeGreaterThan(0);
      for (const { dx, dy } of offsets) {
        expect(Math.abs(dx), 'across, the dot is on the cursor').toBeLessThan(1.5);
        expect(Math.abs(dy), 'up and down, the dot is on the line').toBeLessThan(1.5);
      }
    });
  });
}
