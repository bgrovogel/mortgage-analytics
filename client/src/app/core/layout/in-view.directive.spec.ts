import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { InViewDirective } from './in-view.directive';

@Component({
  imports: [InViewDirective],
  template: `<div (appInView)="seen.push($event)"></div>`,
})
class HostComponent {
  readonly seen: boolean[] = [];
}

/** A stand-in for the browser's IntersectionObserver (jsdom has none) that a test can trigger by hand. */
class FakeObserver {
  static latest: FakeObserver;
  readonly observed: Element[] = [];
  disconnected = false;
  constructor(readonly callback: (entries: Partial<IntersectionObserverEntry>[]) => void) {
    FakeObserver.latest = this;
  }
  observe(element: Element) {
    this.observed.push(element);
  }
  disconnect() {
    this.disconnected = true;
  }
  report(isIntersecting: boolean) {
    this.callback([{ isIntersecting }]);
  }
}

describe('InViewDirective', () => {
  const original = (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
  afterEach(() => ((globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = original));

  it('reports when its element scrolls into and out of view', () => {
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = FakeObserver;
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    FakeObserver.latest.report(true);
    FakeObserver.latest.report(false);

    expect(FakeObserver.latest.observed).toEqual([fixture.nativeElement.querySelector('div')]);
    expect(fixture.componentInstance.seen).toEqual([true, false]);
  });

  it('stops watching when its element is removed', () => {
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = FakeObserver;
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    fixture.destroy();

    expect(FakeObserver.latest.disconnected).toBe(true);
  });

  it('does nothing where the browser has no IntersectionObserver', () => {
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = undefined;
    const fixture = TestBed.createComponent(HostComponent);

    expect(() => fixture.detectChanges()).not.toThrow();
    expect(fixture.componentInstance.seen).toEqual([]);
  });
});
