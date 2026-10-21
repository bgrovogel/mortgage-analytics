import { TestBed } from '@angular/core/testing';
import { SecondLoanComparison, SecondLoanInput, SecondLoanOption } from '../../../core/models/amortization.models';
import { SecondLoanComponent } from './second-loan.component';

describe('SecondLoanComponent', () => {
  const option = (overrides: Partial<SecondLoanOption>): SecondLoanOption => ({
    firstLoan: 225_000, secondLoan: 0, firstLoanPayment: 1_422.09, secondLoanPayment: 0, mortgageInsurance: 93.75, monthlyPayment: 2_015.84,
    cashToClose: 25_000, payments: 170_000, balance: 190_000, cost: 385_000, ...overrides,
  });
  const comparison = (overrides: Partial<SecondLoanComparison> = {}): SecondLoanComparison => ({
    amount: 25_000, annualInterestRate: 8, termInMonths: 180, yearsKept: 7,
    withMortgageInsurance: option({}),
    withSecondLoan: option({ firstLoan: 200_000, secondLoan: 25_000, firstLoanPayment: 1_264.14, secondLoanPayment: 238.91, mortgageInsurance: 0, monthlyPayment: 1_996.5, payments: 168_000, balance: 188_000, cost: 381_000 }),
    saved: 4_000,
    ...overrides,
  });
  const suggested: SecondLoanInput = { amount: 25_000, annualInterestRate: 8.5, termInMonths: 180, yearsKept: 7 };

  const render = (inputs: { comparison?: SecondLoanComparison | null; settings?: SecondLoanInput | null; suggestion?: SecondLoanInput | null }) => {
    const fixture = TestBed.createComponent(SecondLoanComponent);
    fixture.componentRef.setInput('comparison', inputs.comparison ?? null);
    fixture.componentRef.setInput('settings', inputs.settings ?? null);
    fixture.componentRef.setInput('suggestion', inputs.suggestion ?? null);
    const emitted: (SecondLoanInput | null)[] = [];
    fixture.componentInstance.settingsChange.subscribe((s) => emitted.push(s));
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const text = (id: string) => root.querySelector(`[data-testid="${id}"]`)?.textContent?.replace(/\s+/g, ' ').trim();
    const box = (id: string) => root.querySelector(`[data-testid="${id}"]`) as HTMLInputElement;
    const type = (id: string, value: string) => {
      box(id).value = value;
      box(id).dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    return { fixture, root, text, box, type, emitted };
  };

  describe('before one is tried', () => {
    it('offers the usual second loan: what brings the first loan to 80%, at the rate a little above, over 15 years', () => {
      const { text, emitted, root } = render({ suggestion: suggested });

      expect(text('try-second-loan')).toBe('Try $25,000 at 8.5% for 15 years');
      (root.querySelector('[data-testid="try-second-loan"]') as HTMLButtonElement).click();
      expect(emitted).toEqual([suggested]);
    });

    it('says there is no PMI to avoid when 20% is already down', () => {
      const { text, root } = render({ suggestion: null });

      expect(text('second-loan-none')).toBe('There is no PMI to avoid here: at least 20% is put down.');
      expect(root.querySelector('[data-testid="try-second-loan"]')).toBeNull();
    });
  });

  describe('once tried', () => {
    const tried = { comparison: comparison(), settings: { amount: 25_000, annualInterestRate: 8, termInMonths: 180, yearsKept: 7 } };

    it('shows the second loan in its boxes, the term in years', () => {
      const { box } = render(tried);

      expect(box('second-loan-amount').value).toBe('25,000');
      expect(box('second-loan-rate').value).toBe('8');
      expect(box('second-loan-term').value).toBe('15');
      expect(box('second-loan-years').value).toBe('7');
    });

    it('says what the second loan saves, or costs more, over the years kept', () => {
      expect(render(tried).text('second-loan-verdict')).toBe('Over 7 years, the second loan costs $4,000 less than paying PMI.');
      expect(render({ ...tried, comparison: comparison({ saved: -1_250.5 }) }).text('second-loan-verdict')).toBe('Over 7 years, the second loan costs $1,251 more than paying PMI.');
      expect(render({ ...tried, comparison: comparison({ saved: 0 }) }).text('second-loan-verdict')).toBe('Over 7 years, the two cost the same.');
    });

    it('sets the two ways side by side, line by line, with the dearer first loan and PMI against the smaller one and a second loan', () => {
      const { root } = render(tried);
      const rows = [...root.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('th, td')].map((c) => c.textContent!.trim()).join(' | '));

      expect(rows).toEqual([
        'First loan | $225,000 | $200,000',
        'Second loan | None | $25,000',
        'Each month, all in | $2,016 | $1,997',
        'Of which PMI | $94 | None',
        'Cash to close | $25,000 | $25,000',
        'Paid in 7 years | $170,000 | $168,000',
        'Still owed after 7 years | $190,000 | $188,000',
      ]);
      expect(root.querySelector('tfoot')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('Cost over 7 years$385,000$381,000');
    });

    it('marks the cheaper way', () => {
      const cheaper = render(tried).root.querySelectorAll('thead th.best');
      const dearer = render({ ...tried, comparison: comparison({ saved: -10 }) }).root.querySelectorAll('thead th.best');

      expect(cheaper[0].textContent).toContain('With a second loan');
      expect(dearer[0].textContent).toContain('With PMI');
    });

    it('weighs it again with each change in range, the term in months', () => {
      const { type, emitted } = render(tried);

      type('second-loan-rate', '9');
      type('second-loan-term', '20');

      expect(emitted.at(-1)).toEqual({ amount: 25_000, annualInterestRate: 9, termInMonths: 240, yearsKept: 7 });
    });

    it('does not weigh it while a value is out of range', () => {
      const { type, emitted } = render(tried);

      type('second-loan-rate', '31');
      type('second-loan-term', '31');

      expect(emitted).toEqual([]);
    });

    it('stops comparing when asked', () => {
      const { root, emitted } = render(tried);

      (root.querySelector('[data-testid="second-loan-stop"]') as HTMLButtonElement).click();

      expect(emitted).toEqual([null]);
    });
  });
});
