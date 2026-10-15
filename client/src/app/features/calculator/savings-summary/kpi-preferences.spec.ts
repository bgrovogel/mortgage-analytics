import { TestBed } from '@angular/core/testing';
import { KPI_STORAGE_KEY, KpiPreferences } from './kpi-preferences';

describe('KpiPreferences', () => {
  beforeEach(() => localStorage.removeItem(KPI_STORAGE_KEY));
  afterEach(() => localStorage.removeItem(KPI_STORAGE_KEY));

  const create = () => {
    TestBed.resetTestingModule();
    return TestBed.inject(KpiPreferences);
  };

  it('starts with the page\'s own order, every figure shown', () => {
    const prefs = create();

    expect(prefs.visible()).toEqual(['cash', 'payoff', 'afford', 'savings', 'pmi']);
  });

  it('moves a figure a place, and not past either end', () => {
    const prefs = create();

    prefs.move('pmi', -1);
    expect(prefs.order()).toEqual(['cash', 'payoff', 'afford', 'pmi', 'savings']);

    prefs.move('cash', -1);
    prefs.move('savings', 1);
    expect(prefs.order()).toEqual(['cash', 'payoff', 'afford', 'pmi', 'savings']);
  });

  it('puts a figure away and brings it back', () => {
    const prefs = create();

    prefs.toggle('afford');
    expect(prefs.visible()).toEqual(['cash', 'payoff', 'savings', 'pmi']);

    prefs.toggle('afford');
    expect(prefs.visible()).toContain('afford');
  });

  it('remembers the arrangement, and starts from it next time', () => {
    const prefs = create();
    prefs.move('savings', -1);
    prefs.toggle('cash');

    const again = create();

    expect(again.visible()).toEqual(['payoff', 'savings', 'afford', 'pmi']);
  });

  it('keeps to the figures that exist: a name it does not know is dropped, a new one joins at the end', () => {
    localStorage.setItem(KPI_STORAGE_KEY, JSON.stringify({ order: ['pmi', 'old-one', 'cash'], hidden: ['gone'] }));

    expect(create().order()).toEqual(['pmi', 'cash', 'payoff', 'afford', 'savings']);
  });

  it('goes back to the default', () => {
    const prefs = create();
    prefs.move('pmi', -1);
    prefs.toggle('cash');

    prefs.reset();

    expect(prefs.visible()).toEqual(['cash', 'payoff', 'afford', 'savings', 'pmi']);
  });
});
