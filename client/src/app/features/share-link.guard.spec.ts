import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AmortizationApiService } from '../core/services/amortization-api.service';
import { RefinanceApiService } from '../core/services/refinance-api.service';
import { StrategyApiService } from '../core/services/strategy-api.service';
import { shareFragment } from '../core/state/share-link';
import { CalculationStores } from './calculation-stores';
import { openShareLink } from './share-link.guard';

describe('openShareLink', () => {
  const refinance = { currentBalance: 300_000, currentAnnualInterestRate: 7, newAnnualInterestRate: 6 };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AmortizationApiService, useValue: { calculate: () => of({}) } },
        { provide: RefinanceApiService, useValue: { analyze: () => of({}) } },
        { provide: StrategyApiService, useValue: { compare: () => of({}) } },
      ],
    });
  });

  const visit = (url: string, fragment: string | null) =>
    TestBed.runInInjectionContext(() =>
      openShareLink({ fragment } as ActivatedRouteSnapshot, { url: fragment ? `${url}#${fragment}` : url } as RouterStateSnapshot));
  const stores = () => TestBed.inject(CalculationStores);

  it('lets a page open as usual without a share link', () => {
    expect(visit('/refinance', null)).toBe(true);
    expect(visit('/refinance', 'results')).toBe(true);
  });

  it('opens a shared calculation on its page, and drops the link from the address', () => {
    const result = visit('/refinance', shareFragment('Refinance', refinance)) as UrlTree;

    expect(stores().of('Refinance').request()).toEqual(refinance);
    expect(result.toString()).toBe('/refinance');
  });

  it('keeps the tab the link was made on', () => {
    const purchase = { homePrice: 375_000 };

    const result = visit('/calculator/closing', shareFragment('Purchase', purchase)) as UrlTree;

    expect(stores().of('Purchase').request()).toMatchObject(purchase);
    expect(result.toString()).toBe('/calculator/closing');
  });

  it('opens a link on the page of its own kind, whatever page it names', () => {
    const result = visit('/strategy', shareFragment('Refinance', refinance)) as UrlTree;

    expect(stores().of('Refinance').request()).toEqual(refinance);
    expect(stores().of('Strategy').request()).toBeNull();
    expect(result.toString()).toBe('/refinance');
  });

  it('says when a link cannot be read, and changes nothing', () => {
    const result = visit('/refinance', 'share=garbled') as UrlTree;

    expect(stores().of('Refinance').request()).toBeNull();
    expect(stores().of('Refinance').linkProblem()).toBe('This link could not be opened. It may have been cut short when it was copied.');
    expect(result.toString()).toBe('/refinance');
  });

  it('says so on the calculator, the home page, for a broken link to the site itself', () => {
    const result = visit('/', 'share=garbled') as UrlTree;

    expect(stores().of('Purchase').linkProblem()).not.toBeNull();
    expect(result.toString()).toBe('/');
  });

  it('clears what was said about an earlier broken link once a link opens', () => {
    visit('/refinance', 'share=garbled');
    visit('/refinance', shareFragment('Refinance', refinance));

    expect(stores().of('Refinance').linkProblem()).toBeNull();
  });
});
