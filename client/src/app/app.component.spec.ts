import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NEVER } from 'rxjs';
import { fakeCharts } from '../testing/fake-charts';
import { AppComponent } from './app.component';
import { routes } from './app.routes';
import { AmortizationApiService } from './core/services/amortization-api.service';
import { SavedCalculationsApiService } from './core/services/saved-calculations-api.service';
import { RefinanceApiService } from './core/services/refinance-api.service';

describe('AppComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), fakeCharts().provider, { provide: SavedCalculationsApiService, useValue: { list: () => NEVER } }, { provide: RefinanceApiService, useValue: { analyze: () => NEVER } }, { provide: AmortizationApiService, useValue: { calculate: () => NEVER } }],
    });
  });

  it('renders the title, the page navigation and a link to the API docs', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('h1')?.textContent).toBe('Mortgage Analytics');
    expect([...root.querySelectorAll('nav[aria-label="Pages"] a')].map((a) => a.textContent!.trim()))
      .toEqual(['Calculator', 'Refinance', 'History', 'API docs ↗']);
    expect(root.querySelector('a[href="/swagger"]')).not.toBeNull();
  });

  it.each(['/', '/no-such-page', '/calculator'])('sends %s to the calculator overview', async (url) => {
    await RouterTestingHarness.create(url);

    expect(TestBed.inject(Router).url).toBe('/calculator/overview');
  });

  it('has a History page', async () => {
    const harness = await RouterTestingHarness.create('/history');

    expect(harness.routeNativeElement?.querySelector('[data-testid="history-search"]')).not.toBeNull();
  });

  it('has a Refinance page', async () => {
    const harness = await RouterTestingHarness.create('/refinance');

    expect(harness.routeNativeElement?.querySelector('[data-testid="refinance-form"]')).not.toBeNull();
  });
});
