import { TestBed } from '@angular/core/testing';
import { ScrubChartComponent, ScrubChartSpec } from './scrub-chart.component';

describe('ScrubChartComponent', () => {
  const spec = (overrides: Partial<ScrubChartSpec> = {}): ScrubChartSpec => ({
    labels: ['Now', 'Yr 1', 'Yr 2', 'Yr 3', 'Yr 4'],
    series: [
      { label: 'Invest', color: '--series-1', data: [0, 1_000, 2_500, 4_000, 7_500] },
      { label: 'Hybrid', color: '--series-2', data: [0, 800, 2_000, 3_000, 6_000], dashed: true },
    ],
    title: (index, label) => `${label} · after ${index} years`,
    tickEvery: 2,
    ...overrides,
  });

  const render = (s: ScrubChartSpec) => {
    const fixture = TestBed.createComponent(ScrubChartComponent);
    fixture.componentRef.setInput('spec', s);
    fixture.componentRef.setInput('title', 'Net worth over time');
    fixture.componentRef.setInput('testId', 'net-worth-chart');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const text = (id: string) => root.querySelector(`[data-testid="${id}"]`)?.textContent?.replace(/\s+/g, ' ').trim();
    const scrub = (value: number) => {
      const input = root.querySelector('[data-testid="scrub-input"]') as HTMLInputElement;
      input.value = String(value);
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    return { fixture, root, text, scrub };
  };

  it('draws a line for each series, named by the figure title, with the series in a key', () => {
    const { root } = render(spec());
    const svg = root.querySelector('svg[data-testid="net-worth-chart"]')!;

    expect(svg.getAttribute('role')).toBe('img');
    expect(root.querySelector('figcaption')!.textContent).toBe('Net worth over time');
    expect(svg.getAttribute('aria-labelledby')).toBe(root.querySelector('figcaption')!.id);
    expect(root.querySelectorAll('path.line')).toHaveLength(2);
    expect([...root.querySelectorAll('.key li')].map((li) => li.textContent!.trim())).toEqual(['Invest', 'Hybrid']);
  });

  it('draws a dashed series dashed, so it stays visible where it runs along another', () => {
    const { root } = render(spec());

    expect(root.querySelectorAll('path.line')[1].classList).toContain('dashed');
    expect(root.querySelectorAll('path.line')[0].classList).not.toContain('dashed');
  });

  it('reads every series at the point scrubbed to: in the tooltip and to a screen reader', () => {
    const { root, text, scrub } = render(spec());

    scrub(3);

    expect(text('scrub-title')).toBe('Yr 3 · after 3 years');
    expect(text('scrub-row-0')).toBe('Invest $4,000');
    expect(text('scrub-row-1')).toBe('Hybrid $3,000');
    expect((root.querySelector('[data-testid="scrub-input"]') as HTMLInputElement).getAttribute('aria-valuetext'))
      .toBe('Yr 3 · after 3 years: Invest $4,000, Hybrid $3,000');
  });

  it('moves by the tick step with Page Up and Page Down', () => {
    const { fixture, root, text, scrub } = render(spec());
    scrub(1);
    const input = root.querySelector('[data-testid="scrub-input"]') as HTMLInputElement;

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }));
    fixture.detectChanges();

    expect(text('scrub-title')).toBe('Yr 3 · after 3 years');
  });

  it('stacks the series as areas when asked, the top edge being their total, and tells a page which point was chosen', () => {
    const fixture = TestBed.createComponent(ScrubChartComponent);
    const picks: number[] = [];
    fixture.componentInstance.picked.subscribe((i) => picks.push(i));
    fixture.componentRef.setInput('spec', spec({ stacked: true }));
    fixture.componentRef.setInput('title', 'Costs');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelectorAll('path.area')).toHaveLength(2);
    // The second series sits on the first: its top edge is the total, 4,000 + 3,000 at the point after three years.
    const input = root.querySelector('[data-testid="scrub-input"]') as HTMLInputElement;
    input.value = '3';
    input.dispatchEvent(new Event('input'));
    expect(picks).toEqual([3]);
  });

  it('adds the footer line for the point, when the chart has one', () => {
    const { text, scrub } = render(spec({ footer: (i) => `Total: ${i * 100}` }));

    scrub(2);

    expect(text('scrub-footer')).toBe('Total: 200');
  });

  it('draws the zero line when a series goes below it, and labels the top, the zero and the bottom', () => {
    const { root } = render(spec({ series: [{ label: 'Rent vs buy', color: '--series-1', data: [-20_000, -5_000, 10_000, 40_000, 90_000] }] }));

    expect(root.querySelector('line.zero')).not.toBeNull();
    expect([...root.querySelectorAll('.y span')].map((s) => s.textContent!.trim())).toEqual(['$90K', '$0', '-$20K']);
  });

  describe('as a table', () => {
    const toggle = (root: HTMLElement) => root.querySelector('[data-testid="chart-as-table"]') as HTMLButtonElement;

    it('offers the same figures as a table, for anyone who would rather read them than see a drawing', () => {
      const { fixture, root } = render(spec());
      expect(toggle(root).textContent!.trim()).toBe('View as table');
      expect(root.querySelector('table')).toBeNull();

      toggle(root).click();
      fixture.detectChanges();

      const rows = [...root.querySelectorAll('table tr')].map((tr) => [...tr.querySelectorAll('th, td')].map((c) => c.textContent!.trim()).join(' | '));
      expect(rows).toEqual([
        'When | Invest | Hybrid',
        'Now | $0 | $0',
        'Yr 1 | $1,000 | $800',
        'Yr 2 | $2,500 | $2,000',
        'Yr 3 | $4,000 | $3,000',
        'Yr 4 | $7,500 | $6,000',
      ]);
      expect(root.querySelector('table caption')!.textContent!.trim()).toBe('Net worth over time');
      expect(root.querySelector('svg')).toBeNull();
      expect(toggle(root).textContent!.trim()).toBe('View as chart');
      expect(toggle(root).getAttribute('aria-pressed')).toBe('true');
    });

    it('goes back to the chart, with the scrubber where it was', () => {
      const { fixture, root, text, scrub } = render(spec());
      scrub(3);

      toggle(root).click();
      fixture.detectChanges();
      toggle(root).click();
      fixture.detectChanges();

      expect(root.querySelector('svg')).not.toBeNull();
      expect(text('scrub-title')).toBe('Yr 3 · after 3 years');
    });
  });

  describe('pointing at the drawing', () => {
    const point = (root: HTMLElement, type: string, fraction: number) => {
      const canvas = root.querySelector('.canvas') as HTMLElement;
      canvas.getBoundingClientRect = () => ({ left: 100, width: 400, top: 0, height: 320, right: 500, bottom: 320, x: 100, y: 0, toJSON: () => ({}) });
      canvas.dispatchEvent(new MouseEvent(type, { clientX: 100 + 400 * fraction, bubbles: true }));
    };

    it('follows the pointer over the drawing to the nearest point, without choosing it', () => {
      const { fixture, root, text } = render(spec());
      const picks: number[] = [];
      fixture.componentInstance.picked.subscribe((i) => picks.push(i));

      point(root, 'pointermove', 0.76);
      fixture.detectChanges();

      expect(text('scrub-title')).toBe('Yr 3 · after 3 years');
      expect(picks).toEqual([]);
    });

    it('chooses the point pressed, and tells the page', () => {
      const { fixture, root, text } = render(spec());
      const picks: number[] = [];
      fixture.componentInstance.picked.subscribe((i) => picks.push(i));

      point(root, 'pointerdown', 1);
      fixture.detectChanges();

      expect(text('scrub-title')).toBe('Yr 4 · after 4 years');
      expect(picks).toEqual([4]);
    });
  });
});
