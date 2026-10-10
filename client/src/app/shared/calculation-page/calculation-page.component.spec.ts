import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { SavedCalculationsApiService } from '../../core/services/saved-calculations-api.service';
import { CalculationStore } from '../../core/state/calculation-store';
import { RECALCULATE_DELAY_MS } from '../../core/state/latest-request';
import { SharedLoan } from '../../core/state/shared-loan.store';
import { CalculationPageComponent } from './calculation-page.component';

/** A page's store, answering with whatever the test sends through `responses`. */
class TestStore extends CalculationStore<number, string> {
  readonly kind = 'Purchase';
  readonly route = ['/test'];
  readonly pageName = 'Test';
  readonly responses = new Subject<string>();
  describe = (n: number) => `${n}`;
  suggestName = (n: number) => `Test ${n}`;
  protected loanOf(n: number): SharedLoan {
    return { balance: n, annualInterestRate: 0, remainingTermInMonths: 1, homeValue: null };
  }
  protected send$(): Observable<string> {
    return this.responses;
  }
}

@Component({
  imports: [CalculationPageComponent],
  template: `
    <app-calculation-page [store]="store" heading="A question?" [problems]="problems()" placeholder="Working…" errorTitle="That failed.">
      <p form data-testid="the-form">form</p>
      @if (store.result(); as result) {
        <p data-testid="the-result">{{ result }}</p>
      }
    </app-calculation-page>
  `,
})
class HostComponent {
  readonly store = TestBed.runInInjectionContext(() => new TestStore());
  readonly problems = signal<string[]>([]);
}

describe('CalculationPageComponent', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: SavedCalculationsApiService, useValue: {} }, { provide: AuthService, useValue: { user: signal(null) } }],
    });
  });
  afterEach(() => jest.useRealTimers());

  const render = () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const text = (id: string) => root.querySelector(`[data-testid="${id}"]`)?.textContent?.replace(/\s+/g, ' ').trim();
    return { fixture, host: fixture.componentInstance, text };
  };

  it('puts the form beside the results, under the heading, with a placeholder until the first result', () => {
    const { host, fixture, text } = render();
    host.store.send(1);
    fixture.detectChanges();

    expect(text('form-panel')).toBe('form');
    expect(text('results')).toContain('A question?');
    expect(text('results')).toContain('Working…');

    jest.advanceTimersByTime(RECALCULATE_DELAY_MS);
    host.store.responses.next('done');
    fixture.detectChanges();

    expect(text('the-result')).toBe('done');
    expect(text('results')).not.toContain('Working…');
  });

  it('says the results are for the last valid inputs while the form has problems', () => {
    const { host, fixture, text } = render();
    host.store.send(1);
    jest.advanceTimersByTime(RECALCULATE_DELAY_MS);
    host.store.responses.next('done');

    host.problems.set(['Rate must be between 0% and 30%.']);
    fixture.detectChanges();

    expect(text('stale-results')).toBe('These results are for your last valid inputs. Fix this to update them: Rate must be between 0% and 30%.');
    expect(text('the-result')).toBe('done');
  });

  it('shows the problems instead of a placeholder when nothing valid has been sent yet', () => {
    const { host, fixture, text } = render();

    host.problems.set(['Years left must be between 1 month and 30 years.', 'Tax rate must be between 0% and 60%.']);
    fixture.detectChanges();

    expect(text('stale-results')).toContain('Nothing to show yet. Fix these to see results:');
    const items = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="stale-results"] li'), (li: Element) => li.textContent);
    expect(items).toEqual(['Years left must be between 1 month and 30 years.', 'Tax rate must be between 0% and 60%.']);
    expect(text('results')).not.toContain('Working…');
  });

  it("shows the API's errors under the page's own title", () => {
    const { host, fixture, text } = render();
    host.store.send(1);
    jest.advanceTimersByTime(RECALCULATE_DELAY_MS);
    host.store.responses.error({ status: 0 });
    fixture.detectChanges();

    expect(text('calculation-errors')).toContain('That failed.');
    expect(text('results')).not.toContain('Working…');
  });
});
