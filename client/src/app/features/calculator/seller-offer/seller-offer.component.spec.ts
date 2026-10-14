import { TestBed } from '@angular/core/testing';
import { SellerOfferComparison, SellerOfferOption } from '../../../core/models/amortization.models';
import { SellerOfferComponent } from './seller-offer.component';

describe('SellerOfferComponent', () => {
  const way = (option: Partial<SellerOfferOption> & Pick<SellerOfferOption, 'use'>): SellerOfferOption => ({
    homePrice: 415_000, loanAmount: 377_650, annualInterestRate: 5.99, points: 0, firstPayment: 3_100, laterPayment: 3_100,
    cashToClose: 40_000, payments: 260_400, balance: 338_000, cost: 638_400, notUsed: 0, ...option,
  });

  /** An $8,000 offer on a $415,000 home, kept seven years: illustrative figures, each adding up. */
  const offer: SellerOfferComparison = {
    offer: 8_000, yearsKept: 7, rateCutPerPoint: 0.25, best: 'DiscountPoints',
    options: [
      way({ use: 'PriceCut', homePrice: 407_000, loanAmount: 369_650, firstPayment: 3_050, laterPayment: 3_050, cashToClose: 48_000, payments: 256_200, balance: 330_900, cost: 635_100 }),
      way({ use: 'ClosingCosts' }),
      way({ use: 'TemporaryBuydown', firstPayment: 2_660, cashToClose: 40_500, payments: 252_900, cost: 631_400 }),
      way({ use: 'DiscountPoints', annualInterestRate: 5.461, points: 2.118, firstPayment: 2_970, laterPayment: 2_970, payments: 249_480, balance: 334_000, cost: 623_480 }),
    ],
  };

  const render = (comparison: SellerOfferComparison) => {
    const fixture = TestBed.createComponent(SellerOfferComponent);
    fixture.componentRef.setInput('offer', comparison);
    fixture.componentRef.setInput('settings', { yearsKept: comparison.yearsKept, rateCutPerPoint: comparison.rateCutPerPoint });
    const changes: unknown[] = [];
    fixture.componentInstance.settingsChange.subscribe((s) => changes.push(s));
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const type = (testId: string, value: string) => {
      const field = root.querySelector(`[data-testid="${testId}"]`) as HTMLInputElement;
      field.value = value;
      field.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const text = (id: string) => root.querySelector(`[data-testid="${id}"]`)?.textContent?.replace(/\s+/g, ' ').trim();
    const cells = (selector: string) => Array.from(root.querySelectorAll(selector), (c) => c.textContent!.replace(/\s+/g, ' ').trim());
    const row = (label: string) => {
      const tr = Array.from(root.querySelectorAll('tr')).find((r) => r.querySelector('th')?.textContent?.trim() === label);
      return tr ? Array.from(tr.querySelectorAll('td'), (c) => c.textContent!.replace(/\s+/g, ' ').trim()) : undefined;
    };
    return { root, text, cells, row, type, changes };
  };

  it('shows how it is weighed, beside the table: the years kept and the cut per point', () => {
    const { root } = render(offer);

    expect((root.querySelector('[data-testid="years-kept"]') as HTMLInputElement).value).toBe('7');
    expect((root.querySelector('[data-testid="rate-cut-per-point"]') as HTMLInputElement).value).toBe('0.25');
  });

  it('asks to weigh it again when a setting changes, and not while one is out of range', () => {
    const { type, changes } = render(offer);

    type('years-kept', '10');
    type('rate-cut-per-point', '2');

    expect(changes).toEqual([{ yearsKept: 10, rateCutPerPoint: 0.25 }]);
  });

  it('says what the offer is and over how long each way is weighed', () => {
    expect(render(offer).text('offer-intro')).toBe(
      'The seller’s $8,000, taken each way it can be, over the 7 years you keep the loan: what you bring to closing, '
        + 'pay each month, and still owe after.',
    );
  });

  it('names the way that costs the least, and by how much it beats the next', () => {
    expect(render(offer).text('offer-best')).toBe('Taking it as points costs the least: $7,920 less over 7 years than as a 2-1 buydown, the next best.');
  });

  it('has a column for each way, the best one marked', () => {
    const { cells, root } = render(offer);

    expect(cells('thead th')).toEqual(['', 'Off the price', 'Toward closing', '2-1 buydown', 'Points Least']);
    expect(root.querySelectorAll('.best')).toHaveLength(8);
  });

  it('lays out the price, rate, payment, cash to close, payments and balance of each way, then the cost', () => {
    const { row } = render(offer);

    expect(row('Price')).toEqual(['$407,000', '$415,000', '$415,000', '$415,000']);
    expect(row('Rate')).toEqual(['5.99%', '5.99%', '5.99%', '5.461% 2.118 points']);
    expect(row('Monthly payment')).toEqual(['$3,050', '$3,100', '$2,660 $3,100 from year 3', '$2,970']);
    expect(row('Cash to close')).toEqual(['$48,000', '$40,000', '$40,500', '$40,000']);
    expect(row('Payments, 7 years')).toEqual(['$256,200', '$260,400', '$252,900', '$249,480']);
    expect(row('Owed after 7 years')).toEqual(['$330,900', '$338,000', '$338,000', '$334,000']);
    expect(row('Cost over 7 years')).toEqual(['$635,100', '$638,400', '$631,400', '$623,480']);
  });

  it('says a year when the loan is kept for one', () => {
    const { row } = render({ ...offer, yearsKept: 1 });

    expect(row('Payments, 1 year')).toBeDefined();
  });

  it('warns when only part of the offer can pay the costs', () => {
    const over = { ...offer, options: offer.options.map((o) => (o.use === 'PriceCut' ? o : { ...o, notUsed: 2_500 })) };

    expect(render(over).text('offer-not-used')).toBe('Only $5,500 of it can go toward closing: credits pay no more than your costs, within the loan’s limit. Off the price, all of it counts.');
    expect(render(offer).text('offer-not-used')).toBeUndefined();
  });

  it('leaves out a way the offer cannot be taken', () => {
    const { cells } = render({ ...offer, options: offer.options.filter((o) => o.use !== 'PriceCut') });

    expect(cells('thead th')).toEqual(['', 'Toward closing', '2-1 buydown', 'Points Least']);
  });

  it('says nothing of a next best when there is only one way', () => {
    const one = { ...offer, best: 'ClosingCosts' as const, options: [offer.options[1]] };

    expect(render(one).text('offer-best')).toBe('Taking it toward closing costs the least.');
  });
});
