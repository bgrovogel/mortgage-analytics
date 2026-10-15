import { TestBed } from '@angular/core/testing';
import { Affordability, LoanProgramType } from '../../../core/models/amortization.models';
import { AffordabilityComponent } from './affordability.component';

describe('AffordabilityComponent', () => {
  /** $150,000 a year and $600 of debts against the $415,000 example: the API's answer, with 2.2% taxes. */
  const typical: Affordability = {
    monthlyIncome: 12_500, monthlyDebts: 600, housingPayment: 3_460.11, housingPercent: 27.68, totalPercent: 32.48,
    comfortable: { housingPercent: 28, totalPercent: 36, maxHousingPayment: 3_500, maxHomePrice: 420_104, fits: true },
    mostAllowed: { housingPercent: null, totalPercent: 45, maxHousingPayment: 5_025, maxHomePrice: 615_229, fits: true },
    qualifyingRate: 6.5, qualifyingRateBasis: 'NoteRate',
  };

  const render = (affordability: Affordability, program: LoanProgramType = 'Conventional', downPaymentPercent = 9) => {
    const fixture = TestBed.createComponent(AffordabilityComponent);
    fixture.componentRef.setInput('affordability', affordability);
    fixture.componentRef.setInput('program', program);
    fixture.componentRef.setInput('downPaymentPercent', downPaymentPercent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const text = (id: string) => root.querySelector(`[data-testid="${id}"]`)?.textContent?.replace(/\s+/g, ' ').trim();
    // Each row as "name | limit | housing | price | fits"; the name without the limit repeated under it for phones.
    const rows = () => Array.from(root.querySelectorAll('tbody tr'), (tr) =>
      [tr.querySelector('th')!.firstChild!.textContent!.trim(), ...Array.from(tr.querySelectorAll('td'), (c) => c.textContent!.trim())].join(' | '));
    return { text, rows };
  };

  it('leads with the most the household could pay for a home, whatever home is in the form', () => {
    expect(render(typical).text('afford-budget')).toBe(
      'You could buy a home up to $420,104 and stay within the comfortable limits, or up to $615,229 at the most a conventional loan allows.',
    );
  });

  it('says so when the debts leave no room for a home at a limit', () => {
    const none = { ...typical, comfortable: { ...typical.comfortable, maxHomePrice: 0, maxHousingPayment: 0, fits: false } };

    expect(render(none).text('afford-budget')).toBe(
      'Your debts leave no room for a home within the comfortable limits; the most a conventional loan allows is $615,229.',
    );
  });

  it('says so when no limit leaves room for a home', () => {
    const none = {
      ...typical,
      comfortable: { ...typical.comfortable, maxHomePrice: 0, maxHousingPayment: 0, fits: false },
      mostAllowed: { ...typical.mostAllowed, maxHomePrice: 0, maxHousingPayment: 0, fits: false },
    };

    expect(render(none).text('afford-budget')).toBe('Your debts leave no room for a mortgage at these limits.');
  });

  it('names the program’s limit in the sentence', () => {
    expect(render(typical, 'Va').text('afford-budget')).toContain('or up to $615,229 at the most a VA loan allows.');
  });

  it('measures this home’s payment against income, and with the other debts', () => {
    expect(render(typical).text('afford-intro')).toBe(
      'This home’s payment, $3,460 a month with taxes, insurance and mortgage insurance, is 27.68% of your $12,500 monthly '
        + 'income, and 32.48% with your $600 of other debts.',
    );
  });

  it('says nothing of other debts when there are none', () => {
    const none = { ...typical, monthlyDebts: 0, totalPercent: 27.68 };

    expect(render(none).text('afford-intro')).toBe(
      'This home’s payment, $3,460 a month with taxes, insurance and mortgage insurance, is 27.68% of your $12,500 monthly income.',
    );
  });

  it('lays out each limit: what it allows for housing, the highest price, and whether this home fits', () => {
    expect(render(typical).rows()).toEqual([
      'Comfortable | 28% · 36% | $3,500 | $420,104 | Fits',
      'Most a conventional loan allows | 45% in all | $5,025 | $615,229 | Fits',
    ]);
  });

  it('says a home within the comfortable limit is', () => {
    expect(render(typical).text('afford-verdict')).toBe('This home is within the comfortable 28% and 36%.');
  });

  it('says a home past the comfortable limit but within the program’s is, naming the program', () => {
    const stretched = { ...typical, comfortable: { ...typical.comfortable, fits: false }, mostAllowed: { ...typical.mostAllowed, housingPercent: 31, totalPercent: 43 } };

    expect(render(stretched, 'Fha').text('afford-verdict'))
      .toBe('This home is past the comfortable 28% and 36%, but within the most an FHA loan allows, 31% and 43%.');
    expect(render(stretched, 'Fha').rows()[1]).toBe('Most an FHA loan allows | 31% · 43% | $5,025 | $615,229 | Fits');
  });

  it('says a home past every limit is more than a lender would lend on', () => {
    const over = { ...typical, comfortable: { ...typical.comfortable, fits: false }, mostAllowed: { ...typical.mostAllowed, totalPercent: 41, fits: false } };

    expect(render(over, 'Va').text('afford-verdict'))
      .toBe('This home is past the most a VA loan allows, 41%: a lender would not lend this much on this income.');
    expect(render(over, 'Va').rows()[0]).toBe('Comfortable | 28% · 36% | $3,500 | $420,104 | Past it');
  });

  it('shows no price when even the cheapest home is past a limit', () => {
    const broke = { ...typical, comfortable: { ...typical.comfortable, maxHousingPayment: 0, maxHomePrice: 0, fits: false } };

    expect(render(broke).rows()[0]).toBe('Comfortable | 28% · 36% | $0 | None | Past it');
  });

  it('says what the price keeps, and how far each program can stretch', () => {
    expect(render(typical).text('afford-note')).toBe(
      'The highest price keeps this home’s 9% down, rate, taxes and insurance. Fannie Mae allows 45% with good credit and '
        + 'reserves, and up to 50% through its automated underwriting. Lenders count the payment at the note rate, even with a buydown.',
    );
    expect(render(typical, 'Fha').text('afford-note')).toContain('HUD allows up to 40% and 50% with compensating factors, such as cash reserves.');
    expect(render(typical, 'Va').text('afford-note')).toContain('Past 41%, VA asks for 20% more residual income than its guideline.');
  });

  it('says what rate an adjustable rate is qualified at, and why', () => {
    const at = (qualifyingRate: number, qualifyingRateBasis: Affordability['qualifyingRateBasis']) =>
      render({ ...typical, qualifyingRate, qualifyingRateBasis }).text('afford-note');

    expect(at(10, 'MostInFirstFiveYears'))
      .toContain('Lenders count this adjustable rate’s payment at 10%, the most it can reach in its first five years.');
    expect(at(8.5, 'FirstResetOrFullyIndexed')).toContain(
      'Lenders count this adjustable rate’s payment at 8.5%, the higher of its rate after the first change at the cap and the rate it is expected to reset to.',
    );
    expect(at(7, 'StartPlusOnePoint')).toContain(
      'Lenders count this adjustable rate’s payment at 7%, a point above its starting rate, since it can change every year and less than 5% is down.',
    );
    expect(at(6.5, 'NoteRate')).toContain('Lenders count the payment at the note rate, even with a buydown.');
  });
});
