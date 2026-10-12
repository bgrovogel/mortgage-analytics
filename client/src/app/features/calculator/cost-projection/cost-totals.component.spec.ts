import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aHousingCosts, aProjectionYear } from '../../../../testing/builders';
import { CostTotalsComponent } from './cost-totals.component';

describe('CostTotalsComponent', () => {
  let fixture: ComponentFixture<CostTotalsComponent>;

  // Years starting January 2026, 2027 and 2028.
  const projection = [
    aProjectionYear(1, { costs: aHousingCosts({ propertyTax: 6_000, homeownersInsurance: 2_400, total: 8_400 }) }),
    aProjectionYear(2, { costs: aHousingCosts({ propertyTax: 6_300, homeownersInsurance: 2_500, total: 8_800 }) }),
    aProjectionYear(3, { costs: aHousingCosts({ propertyTax: 6_600, homeownersInsurance: 2_600, total: 9_200 }) }),
  ];

  const render = (year: number | null = null) => {
    fixture = TestBed.createComponent(CostTotalsComponent);
    fixture.componentRef.setInput('projection', projection);
    fixture.componentRef.setInput('year', year);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };
  const cells = (root: HTMLElement) =>
    [...root.querySelectorAll('[data-testid="cost-totals"] tr')].map((tr) => [...tr.children].map((c) => c.textContent!.replace(/\s+/g, ' ').trim()));

  afterEach(() => jest.useRealTimers());

  it('gives each cost that year, through that year and over the whole loan, then the total', () => {
    const root = render(2);

    expect(cells(root)).toEqual([
      ['Cost', 'Year 2 (2027)', 'Through year 2', 'All 3 years'],
      ['Property tax', '$6,300', '$12,300', '$18,900'],
      ['Home insurance', '$2,500', '$4,900', '$7,500'],
      ['Total', '$8,800 $733/mo', '$17,200', '$26,400'],
    ]);
  });

  it('starts at year 1 for a loan not started yet', () => {
    jest.useFakeTimers({ now: new Date('2025-06-01') });

    expect(cells(render())[0][1]).toBe('Year 1 (2026)');
  });

  it('starts at the year a loan already being paid is in, so "through" is what has been paid', () => {
    jest.useFakeTimers({ now: new Date('2027-08-01') });

    expect(cells(render())[0][2]).toBe('Through year 2');
  });

  it('shows the year picked in its list, and tells the page', () => {
    const root = render(1);
    const picked: (number | null)[] = [];
    fixture.componentInstance.year.subscribe((year) => picked.push(year));
    const select = root.querySelector<HTMLSelectElement>('[data-testid="cost-totals-year"]')!;

    select.value = '3';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(cells(root)[0][1]).toBe('Year 3 (2028)');
    expect(picked).toEqual([3]);
  });

  it('follows a year chosen elsewhere, such as a click on the chart', () => {
    const root = render(1);

    fixture.componentRef.setInput('year', 3);
    fixture.detectChanges();

    expect(root.querySelector<HTMLSelectElement>('[data-testid="cost-totals-year"]')!.value).toBe('3');
  });
});
