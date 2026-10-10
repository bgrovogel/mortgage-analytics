import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HEADER_HEIGHT_PROPERTY, HeaderHeightDirective } from './header-height.directive';

@Component({
  imports: [HeaderHeightDirective],
  template: '<header appHeaderHeight>Title</header>',
})
class HostComponent {}

describe('HeaderHeightDirective', () => {
  const root = () => document.documentElement.style;
  afterEach(() => {
    root().removeProperty(HEADER_HEIGHT_PROPERTY);
    delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
  });

  const render = (height: number) => {
    const fixture = TestBed.createComponent(HostComponent);
    const header = (fixture.nativeElement as HTMLElement).querySelector('header')!;
    Object.defineProperty(header, 'offsetHeight', { configurable: true, get: () => height });
    fixture.detectChanges();
    return { fixture, header };
  };

  it('publishes the header height on the root element once rendered', () => {
    render(64);

    expect(root().getPropertyValue(HEADER_HEIGHT_PROPERTY)).toBe('64px');
  });

  it('updates it when the header resizes (links wrapping), and stops watching when destroyed', () => {
    let notify = () => {};
    const disconnect = jest.fn();
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      constructor(callback: () => void) {
        notify = callback;
      }
      observe() {}
      disconnect = disconnect;
    };
    let height = 64;
    const fixture = TestBed.createComponent(HostComponent);
    const header = (fixture.nativeElement as HTMLElement).querySelector('header')!;
    Object.defineProperty(header, 'offsetHeight', { configurable: true, get: () => height });
    fixture.detectChanges();

    height = 116;
    notify();
    expect(root().getPropertyValue(HEADER_HEIGHT_PROPERTY)).toBe('116px');

    fixture.destroy();
    expect(disconnect).toHaveBeenCalled();
  });
});
