import { TestBed } from '@angular/core/testing';
import { NEVER } from 'rxjs';
import { fakeCharts } from '../testing/fake-charts';
import { AppComponent } from './app.component';
import { AmortizationApiService } from './core/services/amortization-api.service';

describe('AppComponent', () => {
  it('renders the title, a link to the API docs, and the calculator', () => {
    TestBed.configureTestingModule({
      providers: [fakeCharts().provider, { provide: AmortizationApiService, useValue: { calculate: () => NEVER } }],
    });
    const fixture = TestBed.createComponent(AppComponent);

    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('h1')?.textContent).toBe('Mortgage Analytics');
    expect(root.querySelector('a[href="/swagger"]')).not.toBeNull();
    expect(root.querySelector('app-calculator-page')).not.toBeNull();
  });
});
