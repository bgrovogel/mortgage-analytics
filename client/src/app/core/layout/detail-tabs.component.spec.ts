import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DetailTabsComponent } from './detail-tabs.component';

@Component({
  imports: [DetailTabsComponent],
  template: `
    <app-detail-tabs label="Details" [tabs]="tabs" [(selected)]="selected">
      @switch (selected()) {
        @case ('time') { <p data-testid="time">Over time</p> }
        @case ('table') { <p data-testid="table">Side by side</p> }
        @case ('rate') { <p data-testid="rate">If the rate changes</p> }
      }
    </app-detail-tabs>
  `,
})
class HostComponent {
  readonly tabs = [{ value: 'time', label: 'Over time' }, { value: 'table', label: 'Side by side' }, { value: 'rate', label: 'If the rate changes' }];
  readonly selected = signal('time');
}

describe('DetailTabsComponent', () => {
  const render = () => {
    const fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const tab = (value: string) => root.querySelector(`[data-testid="tab-${value}"]`) as HTMLButtonElement;
    const press = (key: string) => {
      (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      fixture.detectChanges();
    };
    return { fixture, root, tab, press };
  };
  afterEach(() => document.body.replaceChildren());

  it('is a tab list with one tab selected, and its panel named by that tab', () => {
    const { root, tab } = render();
    const panel = root.querySelector('[role="tabpanel"]') as HTMLElement;

    expect(root.querySelector('[role="tablist"]')!.getAttribute('aria-label')).toBe('Details');
    expect([...root.querySelectorAll('[role="tab"]')].map((t) => [t.textContent!.trim(), t.getAttribute('aria-selected')]))
      .toEqual([['Over time', 'true'], ['Side by side', 'false'], ['If the rate changes', 'false']]);
    expect(panel.getAttribute('aria-labelledby')).toBe(tab('time').id);
    expect(tab('time').getAttribute('aria-controls')).toBe(panel.id);
    expect(root.querySelector('[data-testid="time"]')).not.toBeNull();
  });

  it('shows the panel of the tab clicked', () => {
    const { fixture, root, tab } = render();

    tab('table').click();
    fixture.detectChanges();

    expect(root.querySelector('[data-testid="table"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="time"]')).toBeNull();
    expect(tab('table').getAttribute('aria-selected')).toBe('true');
  });

  it('keeps only the selected tab in the tab order, and moves with the arrow keys, wrapping at the ends', () => {
    const { root, tab, press } = render();
    expect([...root.querySelectorAll('[role="tab"]')].map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);

    tab('time').focus();
    press('ArrowRight');
    expect(document.activeElement).toBe(tab('table'));
    press('End');
    expect(document.activeElement).toBe(tab('rate'));
    press('ArrowRight');
    expect(document.activeElement).toBe(tab('time'));
    press('ArrowLeft');
    expect(document.activeElement).toBe(tab('rate'));
    press('Home');
    expect(document.activeElement).toBe(tab('time'));
    expect(tab('time').getAttribute('aria-selected')).toBe('true');
  });
});
