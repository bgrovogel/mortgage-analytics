import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { AmortizationRequest } from '../../core/models/amortization.models';
import { SavedCalculation } from '../../core/models/saved-calculation.models';
import { AmortizationApiService } from '../../core/services/amortization-api.service';
import { SavedCalculationsApiService } from '../../core/services/saved-calculations-api.service';
import { CalculatorStore } from '../calculator/calculator.store';
import { RefinanceStore } from '../refinance/refinance.store';
import { RefinanceApiService } from '../../core/services/refinance-api.service';
import { RefinanceRequest } from '../../core/models/refinance.models';
import { StrategyApiService } from '../../core/services/strategy-api.service';
import { StrategyRequest } from '../../core/models/strategy.models';
import { StrategyStore } from '../strategy/strategy.store';
import { HIDE_AMOUNTS_KEY, HistoryPageComponent, SEARCH_DELAY_MS } from './history-page.component';

describe('HistoryPageComponent', () => {
  let fixture: ComponentFixture<HistoryPageComponent>;
  let api: { list: jest.Mock; update: jest.Mock; delete: jest.Mock };
  let store: CalculatorStore;

  const inputs = { homePrice: 375_000, downPayment: 18_750, annualInterestRate: 6.5, termInMonths: 360, extraPayments: null } as AmortizationRequest;
  const aSaved = (id: string, name: string, overrides: Partial<SavedCalculation> = {}): SavedCalculation => ({
    id, name, kind: 'Purchase', inputs, otherHomes: null, refinance: null, strategy: null, createdAt: '2026-10-09T15:30:00Z', updatedAt: '2026-10-09T15:30:00Z', ...overrides,
  });
  const oak = aSaved('1', 'Oak St, 20% down');
  const maple = aSaved('2', 'Maple Ave', { updatedAt: '2026-10-12T09:00:00Z' });
  const refinance: RefinanceRequest = {
    currentBalance: 300_000, currentAnnualInterestRate: 7, remainingTermInMonths: 300, nextPaymentDate: null,
    newAnnualInterestRate: 6, newTermInMonths: 360, closingCosts: 6_000, financeClosingCosts: false,
  };
  const refi = aSaved('3', 'Refi at 6%', { kind: 'Refinance', inputs: null, refinance });
  const strategy = { currentBalance: 300_000, annualInterestRate: 6.5, monthlyCashToPutToWork: 1_000, riskProfile: 'Balanced' } as StrategyRequest;
  const payOff = aSaved('4', 'Pay off or invest?', { kind: 'Strategy', inputs: null, strategy });

  const create = () => {
    fixture = TestBed.createComponent(HistoryPageComponent);
    fixture.detectChanges();
  };

  beforeEach(() => {
    jest.useFakeTimers();
    api = { list: jest.fn().mockReturnValue(of([oak, maple])), update: jest.fn(), delete: jest.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SavedCalculationsApiService, useValue: api },
        { provide: AmortizationApiService, useValue: { calculate: () => new Subject() } },
        { provide: RefinanceApiService, useValue: { analyze: () => new Subject() } },
        { provide: StrategyApiService, useValue: { compare: () => new Subject() } },
      ],
    });
    store = TestBed.inject(CalculatorStore);
  });
  afterEach(() => jest.useRealTimers());

  const root = () => fixture.nativeElement as HTMLElement;
  const items = () => [...root().querySelectorAll('[data-testid="history-item"]')] as HTMLElement[];
  const names = () => items().map((i) => i.querySelector('h3')!.textContent!.trim());
  const button = (item: HTMLElement, label: string) =>
    [...item.querySelectorAll('button')].find((b) => b.textContent!.trim() === label) as HTMLButtonElement;
  const click = (b: HTMLElement) => {
    b.click();
    fixture.detectChanges();
  };
  const search = (text: string) => {
    const box = root().querySelector('[data-testid="history-search"]') as HTMLInputElement;
    box.value = text;
    box.dispatchEvent(new Event('input'));
    jest.advanceTimersByTime(SEARCH_DELAY_MS);
    fixture.detectChanges();
  };

  describe('the list', () => {
    it('shows every saved calculation, with a one-line summary and when it was saved', () => {
      create();

      expect(names()).toEqual(['Oak St, 20% down', 'Maple Ave']);
      expect(items()[0].textContent).toContain('$375,000 home · 5% down · 6.5% · 30 yr');
      expect(items()[0].textContent).toContain('Saved Oct 9, 2026');
      expect(items()[1].textContent).toContain('Updated Oct 12, 2026');
    });

    it('leads each purchase and refinance with the payment it comes to', () => {
      api.list.mockReturnValue(of([oak, refi, payOff]));
      create();

      expect(items()[0].textContent).toContain('$2,251.74 a month, principal and interest');
      expect(items()[1].textContent).toContain('$1,798.65 a month on the new loan, principal and interest');
      expect(items()[2].querySelector('[data-testid="history-figure"]')).toBeNull(); // a strategy has no one payment
    });

    describe('privacy mode', () => {
    beforeEach(() => localStorage.removeItem(HIDE_AMOUNTS_KEY));
    afterEach(() => localStorage.removeItem(HIDE_AMOUNTS_KEY));
    const figure = (i: number) => items()[i].querySelector('[data-testid="history-figure"]')!.textContent!.trim();
    const hide = () => {
      (root().querySelector('[data-testid="hide-amounts"] input') as HTMLInputElement).click();
      fixture.detectChanges();
    };

    it('masks every dollar amount, keeping its shape, until it is asked for', () => {
      create();
      expect(figure(0)).toContain('$2,251.74');

      hide();

      expect(figure(0)).toBe('$•,•••.•• a month, principal and interest');
      expect(items()[0].querySelector('.summary')!.textContent).toContain('$•••,••• home');
      expect(items()[0].querySelector('.summary')!.textContent).toContain('5% down'); // not money
    });

    it('shows one items amounts on its own button, and masks them again after 30 seconds', () => {
      create();
      hide();
      const reveal = () => items()[0].querySelector('[data-testid="reveal"]') as HTMLButtonElement;

      reveal().click();
      fixture.detectChanges();
      expect(figure(0)).toContain('$2,251.74');
      expect(reveal().getAttribute('aria-label')).toBe('Hide amount for Oak St, 20% down');
      expect(figure(1)).toContain('•'); // the other one stays masked

      jest.advanceTimersByTime(30_000);
      fixture.detectChanges();
      expect(figure(0)).toBe('$•,•••.•• a month, principal and interest');
    });

    it('masks again when the tab loses focus', () => {
      create();
      hide();
      (items()[0].querySelector('[data-testid="reveal"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(figure(0)).toContain('$2,251.74');

      window.dispatchEvent(new Event('blur'));
      fixture.detectChanges();

      expect(figure(0)).toContain('•');
    });

    it('switches with Shift+H, and is remembered', () => {
      create();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'H', shiftKey: true, bubbles: true }));
      fixture.detectChanges();

      expect(figure(0)).toContain('•');
      expect(localStorage.getItem(HIDE_AMOUNTS_KEY)).toBe('1');
    });

    it('does not take the key while a field has it', () => {
      create();
      const search = root().querySelector('[data-testid="history-search"]') as HTMLInputElement;

      search.dispatchEvent(new KeyboardEvent('keydown', { key: 'H', shiftKey: true, bubbles: true }));
      fixture.detectChanges();

      expect(figure(0)).toContain('$2,251.74');
    });
  });

  describe('two side by side', () => {
      const other = aSaved('5', 'Elm Ct', { inputs: { ...inputs, homePrice: 425_000, downPayment: 85_000, annualInterestRate: 6, termInMonths: 180 } });
      const pick = (id: string) => {
        (root().querySelector(`[data-testid="pick-${id}"]`) as HTMLInputElement).click();
        fixture.detectChanges();
      };
      const table = () => [...root().querySelectorAll('[data-testid="saved-pair"] tbody tr')]
        .map((tr) => [...tr.querySelectorAll('th, td')].map((c) => c.textContent!.replace(/\s+/g, ' ').trim()));

      it('puts the numbers of two purchases in one table, with the difference between them', () => {
        api.list.mockReturnValue(of([oak, other]));
        create();

        pick('1');
        expect(root().querySelector('[data-testid="saved-pair"]')).toBeNull(); // one is not a pair
        pick('5');

        expect(table()).toEqual([
          ['Home price', '$375,000', '$425,000', '+$50,000'],
          ['Down payment', '$18,750', '$85,000', '+$66,250'],
          ['Rate', '6.5%', '6%', '−0.5 pt'],
          ['Term', '30 yr', '15 yr', '−15 yr'],
          ['Principal and interest', '$2,251.74', '$2,869.11', '+$617.37'],
        ]);
      });

      it('only offers a pick for purchases, and holds it to two', () => {
        api.list.mockReturnValue(of([oak, maple, other, refi]));
        create();

        pick('1');
        pick('2');
        expect(root().querySelector('[data-testid="pick-5"]')!.hasAttribute('disabled')).toBe(true); // a third waits
        expect(root().querySelector('[data-testid="pick-3"]')).toBeNull(); // a refinance has none
      });

      it('goes away when one of the two is put back', () => {
        api.list.mockReturnValue(of([oak, other]));
        create();
        pick('1');
        pick('5');

        pick('1');

        expect(root().querySelector('[data-testid="saved-pair"]')).toBeNull();
      });
    });

    it('groups what is shown by the page each opens on, newest first within a group, with how many there are', () => {
      api.list.mockReturnValue(of([oak, refi, maple, payOff]));
      create();

      const groups = [...root().querySelectorAll('[data-testid="history-group"]')].map((g) => ({
        title: g.querySelector('h3.group-title')!.textContent!.replace(/\s+/g, ' ').trim(),
        names: [...g.querySelectorAll('[data-testid="history-item"] h3')].map((h) => h.textContent!.trim()),
      }));

      expect(groups).toEqual([
        { title: 'Calculator 2', names: ['Oak St, 20% down', 'Maple Ave'] },
        { title: 'Refinance 1', names: ['Refi at 6%'] },
        { title: 'Pay off or invest 1', names: ['Pay off or invest?'] },
      ]);
    });

    it('shows one group, without a title of its own, when a kind is chosen', () => {
      api.list.mockReturnValue(of([oak, refi, maple, payOff]));
      create();

      click(root().querySelector('[data-testid="kind-filter-Refinance"]') as HTMLElement);

      expect(root().querySelectorAll('[data-testid="history-group"]')).toHaveLength(1);
      expect(root().querySelector('h3.group-title')).toBeNull();
      expect(names()).toEqual(['Refi at 6%']);
    });

    it('searches by name after a pause in typing', () => {
      create();
      api.list.mockReturnValue(of([maple]));

      search('map');

      expect(api.list).toHaveBeenLastCalledWith('map');
      expect(names()).toEqual(['Maple Ave']);
    });

    it('explains an empty history, with a way to the calculator', () => {
      api.list.mockReturnValue(of([]));
      create();

      expect(root().querySelector('[data-testid="history-empty"]')!.textContent).toContain('No saved calculations yet');
      expect(root().querySelector('[data-testid="history-empty"] a')!.getAttribute('href')).toBe('/calculator');
    });

    it('says when nothing matches a search', () => {
      create();
      api.list.mockReturnValue(of([]));

      search('zzz');

      expect(root().querySelector('[data-testid="history-empty"]')!.textContent).toContain('Nothing matches “zzz”');
    });

    it('shows what went wrong when the list cannot be loaded, and still searches afterwards', () => {
      api.list.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
      create();
      expect(root().querySelector('[role="alert"]')).not.toBeNull();

      api.list.mockReturnValue(of([oak]));
      search('oak');

      expect(names()).toEqual(['Oak St, 20% down']);
      expect(root().querySelector('[role="alert"]')).toBeNull();
    });
  });

  describe('opening', () => {
    it('loads the saved inputs into the calculator and goes there', () => {
      const navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      create();

      click(button(items()[0], 'Open'));

      expect(store.request()).toEqual({ ...oak.inputs, sellerOffer: { yearsKept: 7, rateCutPerPoint: 0.25 }, rentOrBuy: null, sale: { sellingCostPercent: 6, filingStatus: 'Single', gainsTaxRatePercent: 15 }, rental: null });
      expect(store.saved()).toEqual({ id: '1', name: 'Oak St, 20% down' });
      expect(navigate).toHaveBeenCalledWith(['/calculator', 'overview']);
    });
  });

  describe('renaming', () => {
    it('renames in place, keeping the inputs', () => {
      create();
      api.update.mockReturnValue(of({ ...oak, name: 'Oak St, final' }));

      click(button(items()[0], 'Rename'));
      const box = items()[0].querySelector('input') as HTMLInputElement;
      expect(box.value).toBe('Oak St, 20% down');
      box.value = 'Oak St, final';
      box.dispatchEvent(new Event('input'));
      click(button(items()[0], 'Save'));

      expect(api.update).toHaveBeenCalledWith('1', 'Oak St, final', { inputs: oak.inputs });
      expect(names()).toEqual(['Oak St, final', 'Maple Ave']);
    });

    it('keeps the calculator linked to the new name when it is the open calculation', () => {
      store.linkTo(oak);
      create();
      api.update.mockReturnValue(of({ ...oak, name: 'Renamed' }));

      click(button(items()[0], 'Rename'));
      click(button(items()[0], 'Save'));

      expect(store.saved()).toEqual({ id: '1', name: 'Renamed' });
    });

    it('can be cancelled', () => {
      create();

      click(button(items()[0], 'Rename'));
      click(button(items()[0], 'Cancel'));

      expect(items()[0].querySelector('input[type="text"]')).toBeNull();
      expect(api.update).not.toHaveBeenCalled();
    });
  });

  describe('deleting', () => {
    it('asks first, then deletes and removes it from the list', () => {
      create();
      api.delete.mockReturnValue(of(undefined));

      click(button(items()[0], 'Delete'));
      expect(items()[0].textContent).toContain('Delete “Oak St, 20% down”?');
      expect(api.delete).not.toHaveBeenCalled();

      click(button(items()[0], 'Yes, delete'));

      expect(api.delete).toHaveBeenCalledWith('1');
      expect(names()).toEqual(['Maple Ave']);
    });

    it('keeps it when the answer is no', () => {
      create();

      click(button(items()[0], 'Delete'));
      click(button(items()[0], 'Keep'));

      expect(api.delete).not.toHaveBeenCalled();
      expect(names()).toEqual(['Oak St, 20% down', 'Maple Ave']);
    });

    it('unlinks the calculator from a deleted calculation, so it is not updated by mistake', () => {
      store.linkTo(oak);
      create();
      api.delete.mockReturnValue(of(undefined));

      click(button(items()[0], 'Delete'));
      click(button(items()[0], 'Yes, delete'));

      expect(store.saved()).toBeNull();
    });

    it('shows what went wrong when a delete fails, and keeps the calculation', () => {
      create();
      api.delete.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404, error: { title: 'There is no saved calculation with that id.' } })));

      click(button(items()[0], 'Delete'));
      click(button(items()[0], 'Yes, delete'));

      expect(root().querySelector('[role="alert"]')!.textContent).toContain('There is no saved calculation with that id.');
      expect(names()).toEqual(['Oak St, 20% down', 'Maple Ave']);
    });
  });

  describe('refinance comparisons', () => {
    beforeEach(() => api.list.mockReturnValue(of([oak, refi])));

    it('are marked as such, with a summary of the refinance', () => {
      create();

      expect(items()[1].querySelector('[data-testid="kind-badge"]')!.textContent!.trim()).toBe('Refinance');
      expect(items()[1].textContent).toContain('$300,000 left at 7% → 6% · 30 yr · $6,000 closing costs');
      expect(items()[0].querySelector('[data-testid="kind-badge"]')!.textContent!.trim()).toBe('Calculator');
    });

    it('open on the Refinance page', () => {
      const navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      create();

      click(button(items()[1], 'Open'));

      expect(TestBed.inject(RefinanceStore).saved()).toEqual({ id: '3', name: 'Refi at 6%' });
      expect(TestBed.inject(RefinanceStore).request()).toBe(refinance);
      expect(navigate).toHaveBeenCalledWith(['/refinance']);
    });

    it('keep their inputs when renamed', () => {
      create();
      api.update.mockReturnValue(of({ ...refi, name: 'Refi, final' }));

      click(button(items()[1], 'Rename'));
      click(button(items()[1], 'Save'));

      expect(api.update).toHaveBeenCalledWith('3', 'Refi at 6%', { refinance });
    });

    it('can be shown on their own, or hidden', () => {
      create();
      const show = (kind: string) => click(root().querySelector(`[data-testid="kind-filter-${kind}"]`) as HTMLElement);

      show('Refinance');
      expect(names()).toEqual(['Refi at 6%']);

      show('Purchase');
      expect(names()).toEqual(['Oak St, 20% down']);

      show('all');
      expect(names()).toEqual(['Oak St, 20% down', 'Refi at 6%']);
    });
  });

  describe('pay-off-or-invest comparisons', () => {
    beforeEach(() => api.list.mockReturnValue(of([oak, payOff])));

    it('are marked as such, with a summary of the comparison', () => {
      create();

      expect(items()[1].querySelector('[data-testid="kind-badge"]')!.textContent!.trim()).toBe('Pay off or invest');
      expect(items()[1].textContent).toContain('$300,000 left at 6.5% · $1,000/mo to put to work · Balanced');
    });

    it('open on the Pay off or invest page', () => {
      const navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      create();

      click(button(items()[1], 'Open'));

      expect(TestBed.inject(StrategyStore).saved()).toEqual({ id: '4', name: 'Pay off or invest?' });
      expect(TestBed.inject(StrategyStore).request()).toBe(strategy);
      expect(navigate).toHaveBeenCalledWith(['/strategy']);
    });

    it('keep their inputs when renamed, and the open comparison follows the new name', () => {
      create();
      TestBed.inject(StrategyStore).linkTo(payOff);
      api.update.mockReturnValue(of({ ...payOff, name: 'Pay off, final' }));

      click(button(items()[1], 'Rename'));
      click(button(items()[1], 'Save'));

      expect(api.update).toHaveBeenCalledWith('4', 'Pay off or invest?', { strategy });
      expect(TestBed.inject(StrategyStore).saved()).toEqual({ id: '4', name: 'Pay off, final' });
    });

    it('unlink the open comparison when deleted', () => {
      create();
      TestBed.inject(StrategyStore).linkTo(payOff);
      api.delete.mockReturnValue(of(undefined));

      click(button(items()[1], 'Delete'));
      click(button(items()[1], 'Yes, delete'));

      expect(TestBed.inject(StrategyStore).saved()).toBeNull();
    });

    it('can be shown on their own', () => {
      create();

      click(root().querySelector('[data-testid="kind-filter-Strategy"]') as HTMLElement);

      expect(names()).toEqual(['Pay off or invest?']);
    });
  });
});
