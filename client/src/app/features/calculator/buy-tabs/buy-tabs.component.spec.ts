import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Component } from '@angular/core';
import { BUY_TABS, BuyTabsComponent } from './buy-tabs.component';

@Component({ template: '<app-buy-tabs />', imports: [BuyTabsComponent] })
class HostComponent {}

@Component({ template: '' })
class BlankComponent {}

describe('BuyTabsComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'calculator/:tab', component: BlankComponent },
          { path: 'compare', component: BlankComponent },
          { path: '', component: HostComponent },
        ]),
      ],
    });
  });


  it('lists four questions, each with its own address, and the three views under Cost one step down', async () => {
    await RouterTestingHarness.create('/calculator/overview');
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const named = (selector: string) =>
      [...root.querySelectorAll<HTMLAnchorElement>(selector)].map((a) => [a.textContent!.trim(), a.getAttribute('href')]);

    expect(named('nav[aria-label="Results"] a')).toEqual([
      ['Cost', '/calculator/overview'], ['Can I afford it?', '/calculator/affordability'],
      ['Rent or buy?', '/calculator/rent-or-buy'], ['Compare', '/compare'],
    ]);
    expect(named('nav[aria-label="Go deeper"] a')).toEqual([
      ['Closing costs', '/calculator/closing'], ['Year by year', '/calculator/projection'], ['Every payment', '/calculator/schedule'],
    ]);
    expect(BUY_TABS.map((t) => t.id)).toEqual(['overview', 'affordability', 'closing', 'rent-or-buy', 'projection', 'schedule', 'compare']);
  });

  it('keeps Cost marked while a view under it is open, and shows the way to the others', async () => {
    await RouterTestingHarness.create('/calculator/schedule');
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="result-tab-overview"]')?.classList.contains('active')).toBe(true);
    expect(root.querySelector('[data-testid="result-tab-schedule"]')?.getAttribute('aria-current')).toBe('page');
    expect(root.querySelector('[data-testid="result-tab-closing"]')).not.toBeNull();
  });

  it('leaves the second row out on the other questions, where there is nothing under them', async () => {
    await RouterTestingHarness.create('/calculator/affordability');
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="depth-views"]')).toBeNull();
    expect(root.querySelector('[data-testid="result-tab-affordability"]')?.getAttribute('aria-current')).toBe('page');
  });

  it('marks Compare while it is open', async () => {
    await RouterTestingHarness.create('/compare');
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="result-tab-compare"]')?.getAttribute('aria-current')).toBe('page');
    expect(root.querySelector('[data-testid="result-tab-overview"]')?.getAttribute('aria-current')).toBeNull();
  });
});
