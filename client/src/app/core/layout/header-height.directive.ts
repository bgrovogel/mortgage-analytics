import { DOCUMENT } from '@angular/common';
import { DestroyRef, Directive, ElementRef, afterNextRender, inject } from '@angular/core';

/** The CSS custom property, set on the root element, that holds the page header's height in pixels. */
export const HEADER_HEIGHT_PROPERTY = '--app-header-height';

/**
 * Publishes its element's height as `--app-header-height` on the root element, and keeps it current with
 * a ResizeObserver. Layouts that must fit beneath the header (the calculator's scrolling form) size
 * themselves from it, so a header whose links wrap onto a second line never pushes them off screen.
 * Where ResizeObserver is missing (jsdom), it publishes the height once.
 *
 * Usage: `<header appHeaderHeight>`.
 */
@Directive({ selector: '[appHeaderHeight]' })
export class HeaderHeightDirective {
  constructor() {
    const element = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
    const root = inject(DOCUMENT).documentElement;
    const destroyRef = inject(DestroyRef);
    const publish = () => root.style.setProperty(HEADER_HEIGHT_PROPERTY, `${element.offsetHeight}px`);

    afterNextRender(() => {
      publish();
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(publish);
      observer.observe(element);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
