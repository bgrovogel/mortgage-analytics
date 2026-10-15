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

  const links = (root: HTMLElement) => [...root.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Results"] a')];

  it('lists the views of buying a home, then compare, each with its own address', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    expect(links(fixture.nativeElement).map((a) => [a.textContent!.trim(), a.getAttribute('href')])).toEqual([
      ['Overview', '/calculator/overview'], ['Affordability', '/calculator/affordability'], ['Closing', '/calculator/closing'],
      ['Rent or buy', '/calculator/rent-or-buy'], ['Projection', '/calculator/projection'], ['Schedule', '/calculator/schedule'],
      ['Compare', '/compare'],
    ]);
    expect(BUY_TABS.map((t) => t.id)).toEqual(['overview', 'affordability', 'closing', 'rent-or-buy', 'projection', 'schedule', 'compare']);
  });

  it('keeps each test id by its view, and marks the one open', async () => {
    const harness = await RouterTestingHarness.create('/compare');
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="result-tab-compare"]')?.getAttribute('aria-current')).toBe('page');
    expect(root.querySelector('[data-testid="result-tab-overview"]')?.getAttribute('aria-current')).toBeNull();
    expect(harness).toBeTruthy();
  });
});
