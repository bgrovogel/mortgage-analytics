// Not part of the suite: a sweep of every page for the problems a script can see.
import { chromium } from '@playwright/test';

const out = process.argv[2];
const app = 'http://localhost:4200';
const pages = ['/', '/calculator/overview', '/calculator/affordability', '/calculator/closing', '/calculator/rent-or-buy', '/calculator/projection', '/calculator/schedule',
  '/compare', '/refinance', '/strategy', '/how-it-works', '/glossary', '/privacy', '/sign-in', '/forgot-password', '/reset-password', '/confirm-email', '/no-such-page'];
const sizes = [['desktop', { width: 1440, height: 900 }], ['tablet', { width: 820, height: 1100 }], ['phone', { width: 390, height: 844 }]];
const browser = await chromium.launch();
const findings = [];

for (const [sizeName, viewport] of sizes) {
  for (const scheme of ['dark', 'light']) {
    const context = await browser.newContext({ viewport, colorScheme: scheme, hasTouch: sizeName === 'phone' });
    for (const path of pages) {
      const page = await context.newPage();
      await page.addInitScript(() => localStorage.setItem('first-visit-hints', '1'));
      const issues = [];
      page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) issues.push(`console ${m.type()}: ${m.text().slice(0, 160)}`); });
      page.on('pageerror', (e) => issues.push(`pageerror: ${e.message.slice(0, 160)}`));
      page.on('requestfailed', (r) => issues.push(`request failed: ${r.url().slice(0, 100)}`));
      page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/session')) issues.push(`HTTP ${r.status()}: ${r.url().slice(0, 100)}`); });
      await page.goto(app + path);
      await page.waitForTimeout(2200);
      const dom = await page.evaluate(({ phone }) => {
        const found = [];
        const doc = document.documentElement;
        if (doc.scrollWidth > doc.clientWidth + 1) found.push(`sideways scroll: page is ${doc.scrollWidth}px in a ${doc.clientWidth}px window`);
        const wide = [...document.querySelectorAll('body *')].filter((el) => {
          const r = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return r.width > 0 && r.right > doc.clientWidth + 2 && style.position !== 'fixed' && !el.closest('[style*="overflow"]') && !el.closest('.table-wrap, .scroll, [tabindex="0"]') && style.visibility !== 'hidden';
        }).slice(0, 4).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 30)} ends at ${Math.round(el.getBoundingClientRect().right)}`);
        if (wide.length) found.push(`past the right edge: ${wide.join('; ')}`);
        if (phone) {
          const small = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, [role=tab], [role=button]')].filter((el) => {
            const r = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && (r.height < 40 || r.width < 40) && !el.matches('input[type=checkbox], input[type=radio], input[type=range]') && el.closest('p, li, small, .hint, footer, .links') === null;
          }).slice(0, 5).map((el) => `${el.tagName.toLowerCase()}[${(el.getAttribute('data-testid') || el.textContent || '').trim().slice(0, 24)}] ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
          if (small.length) found.push(`small tap targets: ${small.join('; ')}`);
        }
        const noAlt = [...document.querySelectorAll('img:not([alt])')].length;
        if (noAlt) found.push(`${noAlt} images with no alt`);
        const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
        const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
        if (dup.length) found.push(`duplicate ids: ${[...new Set(dup)].slice(0, 4).join(', ')}`);
        const h1 = document.querySelectorAll('h1').length;
        if (h1 !== 1) found.push(`${h1} h1 headings`);
        const unlabeled = [...document.querySelectorAll('input:not([type=hidden]):not([type=range]), select, textarea')].filter((el) => !el.labels?.length && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && el.getBoundingClientRect().width > 0).slice(0, 3).map((el) => el.getAttribute('data-testid') || el.name || el.type);
        if (unlabeled.length) found.push(`unlabeled fields: ${unlabeled.join(', ')}`);
        const clipped = [...document.querySelectorAll('button, a, h1, h2, h3, label, td, th, span')].filter((el) => {
          const s = getComputedStyle(el);
          return el.getBoundingClientRect().width > 0 && s.overflow === 'hidden' && s.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1;
        }).slice(0, 3).map((el) => (el.textContent || '').trim().slice(0, 30));
        if (clipped.length) found.push(`text cut off with an ellipsis: ${clipped.join(' | ')}`);
        return found;
      }, { phone: sizeName === 'phone' });
      for (const i of [...new Set([...issues, ...dom])]) findings.push(`${sizeName}/${scheme} ${path}: ${i}`);
      if (scheme === 'dark' || sizeName === 'desktop') await page.screenshot({ path: `${out}/${sizeName}-${scheme}${path.replace(/\//g, '_') || '_home'}.png`, fullPage: true });
      await page.close();
    }
    await context.close();
  }
}
await browser.close();
console.log(findings.length ? findings.join('\n') : 'nothing found');
