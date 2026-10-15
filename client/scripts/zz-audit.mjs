// Temporary: a sweep of every page at three widths in both themes, with automated checks. Not committed.
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const app = 'http://localhost:4200';
const out = process.env.OUT;
mkdirSync(out, { recursive: true });

const routes = [
  '/', '/calculator/overview', '/calculator/affordability', '/calculator/rent-or-buy', '/calculator/closing',
  '/calculator/projection', '/calculator/schedule', '/compare', '/refinance', '/strategy', '/how-it-works',
  '/glossary', '/privacy', '/history', '/sign-in', '/forgot-password', '/no-such-page',
];
const viewports = { desktop: { width: 1440, height: 900 }, tablet: { width: 820, height: 1100 }, phone: { width: 390, height: 844 } };
const themes = ['light', 'dark'];

const findings = [];
const slug = (r) => (r === '/' ? 'home' : r.slice(1).replace(/\//g, '-'));

const browser = await chromium.launch();
for (const [vname, viewport] of Object.entries(viewports)) {
  for (const scheme of themes) {
    const context = await browser.newContext({ viewport, colorScheme: scheme });
    await context.addInitScript(() => localStorage.setItem('first-visit-hints', '1'));
    for (const route of routes) {
      const page = await context.newPage();
      const problems = [];
      page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text().slice(0, 160)}`); });
      page.on('pageerror', (e) => problems.push(`pageerror: ${String(e).slice(0, 160)}`));
      page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/api/v1/auth/')) problems.push(`http ${r.status()} ${r.url().slice(0, 100)}`); });
      await page.goto(`${app}${route}`, { waitUntil: 'networkidle' }).catch((e) => problems.push(`goto: ${e.message.slice(0, 100)}`));
      await page.waitForTimeout(700);

      const dom = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const res = { overflowX: document.documentElement.scrollWidth - vw, wide: [], small: [], clipped: [], headings: [], h1: 0, noName: [] };
        const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
        const label = (el) => `${el.tagName.toLowerCase()}${el.dataset?.testid ? `[${el.dataset.testid}]` : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} "${(el.textContent || '').trim().slice(0, 30)}"`;
        for (const el of document.querySelectorAll('body *')) {
          if (!visible(el)) continue;
          const r = el.getBoundingClientRect();
          if (r.right > vw + 1 && !el.closest('.table-wrap, .table-frame, pre, [style*="overflow"], app-balance-chart, svg, canvas, .scroll-x, .tabs, [class*="scroll"], thead, tbody')) {
            if (res.wide.length < 6) res.wide.push(label(el) + ` right=${Math.round(r.right)}`);
          }
          if (el.matches('a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab]')) {
            if ((r.width < 24 || r.height < 24) && !el.matches('input[type=checkbox], input[type=radio]') && res.small.length < 8) res.small.push(label(el) + ` ${Math.round(r.width)}x${Math.round(r.height)}`);
            const name = (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.textContent || el.getAttribute('title') || (el.labels && el.labels.length) || el.getAttribute('placeholder') || '').toString().trim();
            if (!name && res.noName.length < 5) res.noName.push(label(el));
          }
          const s = getComputedStyle(el);
          if (el.children.length === 0 && el.scrollWidth > el.clientWidth + 2 && (s.overflow === 'hidden' || s.textOverflow === 'ellipsis') && res.clipped.length < 5) res.clipped.push(label(el));
          if (/^H[1-6]$/.test(el.tagName)) { res.headings.push(Number(el.tagName[1])); if (el.tagName === 'H1') res.h1++; }
        }
        return res;
      });
      if (dom.overflowX > 1) problems.push(`page scrolls sideways by ${dom.overflowX}px`);
      for (const w of dom.wide) problems.push(`past the right edge: ${w}`);
      for (const w of dom.small) problems.push(`small target: ${w}`);
      for (const w of dom.clipped) problems.push(`clipped text: ${w}`);
      for (const w of dom.noName) problems.push(`no accessible name: ${w}`);
      if (dom.h1 !== 1) problems.push(`h1 count ${dom.h1}`);
      for (let i = 1; i < dom.headings.length; i++) if (dom.headings[i] - dom.headings[i - 1] > 1) { problems.push(`heading jumps h${dom.headings[i - 1]} to h${dom.headings[i]}`); break; }

      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze().catch(() => null);
      if (axe) for (const v of axe.violations) problems.push(`axe ${v.impact} ${v.id}: ${v.nodes.length} node(s) e.g. ${v.nodes[0].target.join(' ').slice(0, 80)}`);

      await page.screenshot({ path: `${out}/${vname}-${scheme}-${slug(route)}.png`, fullPage: true });
      if (problems.length) findings.push({ vname, scheme, route, problems });
      await page.close();
    }
    await context.close();
  }
}
await browser.close();
writeFileSync(`${out}/findings.json`, JSON.stringify(findings, null, 1));
console.log(`${findings.length} page/viewport/theme combinations with findings`);
