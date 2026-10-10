import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aResponse } from '../../../../testing/builders';
import { fakeCharts } from '../../../../testing/fake-charts';
import { TrendsComponent } from './trends.component';

describe('TrendsComponent', () => {
  let fixture: ComponentFixture<TrendsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [fakeCharts().provider] });
    fixture = TestBed.createComponent(TrendsComponent);
    fixture.componentRef.setInput('result', aResponse());
    fixture.detectChanges();
  });

  const el = (selector: string) => fixture.nativeElement.querySelector(selector) as HTMLElement | null;
  const tab = (name: string) => el(`[data-testid="tab-${name}"]`)!;
  const shown = () => ({
    balance: el('[data-testid="balance-chart"]') !== null,
    projection: el('[data-testid="projection-chart"]') !== null,
    caption: el('[role="tabpanel"] figcaption')!.textContent!.trim(),
  });
  const press = (name: string, key: string) => {
    tab(name).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
  };

  it('opens on the balance chart', () => {
    expect(shown()).toEqual({ balance: true, projection: false, caption: 'Remaining balance over time' });
    expect(tab('balance').getAttribute('aria-selected')).toBe('true');
  });

  it('switches to the yearly costs and the home value charts', () => {
    tab('costs').click();
    fixture.detectChanges();
    expect(shown()).toEqual({ balance: false, projection: true, caption: 'Projected yearly taxes & costs' });

    tab('value').click();
    fixture.detectChanges();
    expect(shown()).toEqual({ balance: false, projection: true, caption: 'Home value vs. taxable value' });
  });

  it('is a proper tab list: one selected tab in the tab order, and a panel labelled by it', () => {
    tab('costs').click();
    fixture.detectChanges();

    const tabs = Array.from(fixture.nativeElement.querySelectorAll('[role="tab"]')) as HTMLElement[];
    expect(tabs.map((t) => [t.getAttribute('aria-selected'), t.tabIndex])).toEqual([['false', -1], ['true', 0], ['false', -1]]);
    expect(el('[role="tabpanel"]')!.getAttribute('aria-labelledby')).toBe(tab('costs').id);
    expect(tab('costs').getAttribute('aria-controls')).toBe(el('[role="tabpanel"]')!.id);
  });

  it('moves between tabs with the arrow keys, wrapping at the ends, and focuses the new tab', () => {
    press('balance', 'ArrowRight');
    expect(tab('costs').getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab('costs'));

    press('costs', 'ArrowLeft');
    press('balance', 'ArrowLeft');
    expect(tab('value').getAttribute('aria-selected')).toBe('true');

    press('value', 'Home');
    expect(tab('balance').getAttribute('aria-selected')).toBe('true');

    press('balance', 'End');
    expect(tab('value').getAttribute('aria-selected')).toBe('true');
  });

  it('ignores other keys', () => {
    press('balance', 'a');

    expect(tab('balance').getAttribute('aria-selected')).toBe('true');
  });
});
