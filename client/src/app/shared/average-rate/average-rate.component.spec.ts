import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AverageRates, AverageRatesService } from '../../core/services/average-rates.service';
import { AverageRateComponent } from './average-rate.component';

describe('AverageRateComponent', () => {
  const rates: AverageRates = { asOf: '2026-10-15', thirtyYearFixed: 7.41, fifteenYearFixed: 6.71, source: 'Freddie Mac Primary Mortgage Market Survey' };
  let loaded: number;

  const render = (average: AverageRates | null, inputs: { termYears?: number | null; current?: number | null } = {}) => {
    loaded = 0;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: AverageRatesService, useValue: { rates: signal(average).asReadonly(), load: () => loaded++ } }] });
    const fixture = TestBed.createComponent(AverageRateComponent);
    fixture.componentRef.setInput('termYears', inputs.termYears === undefined ? 30 : inputs.termYears);
    fixture.componentRef.setInput('current', inputs.current ?? null);
    const used: number[] = [];
    fixture.componentInstance.use.subscribe((rate) => used.push(rate));
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    return { root, used, text: () => root.querySelector('[data-testid="average-rate"]')?.textContent?.replace(/\s+/g, ' ').trim(), button: () => root.querySelector('[data-testid="use-average-rate"]') as HTMLButtonElement | null };
  };

  it('asks for the rates when it appears', () => {
    render(rates);

    expect(loaded).toBe(1);
  });

  it('says this week’s 30-year average, who publishes it, and for which week', () => {
    const { text } = render(rates);

    expect(text()).toBe('This week’s average 30-year fixed rate: 7.41% (Freddie Mac, Oct 15). Use 7.41%');
  });

  it('gives the 15-year average for a 15-year loan, and the 30-year for any other term', () => {
    expect(render(rates, { termYears: 15 }).text()).toContain('15-year fixed rate: 6.71%');
    expect(render(rates, { termYears: 20 }).text()).toContain('30-year fixed rate: 7.41%');
    expect(render(rates, { termYears: null }).text()).toContain('30-year fixed rate: 7.41%');
  });

  it('starts the rate from it when asked', () => {
    const { button, used } = render(rates, { termYears: 15 });

    button()!.click();

    expect(used).toEqual([6.71]);
  });

  it('does not offer what the box already says', () => {
    const { button, root } = render(rates, { current: 7.41 });

    expect(button()).toBeNull();
    expect(root.querySelector('[data-testid="using-average-rate"]')?.textContent).toBe('You are using it.');
  });

  it('shows nothing when there are no rates', () => {
    const { root } = render(null);

    expect(root.textContent!.trim()).toBe('');
  });
});
