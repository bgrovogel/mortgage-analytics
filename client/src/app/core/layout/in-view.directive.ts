import { DestroyRef, Directive, ElementRef, afterNextRender, inject, output } from '@angular/core';

/**
 * Emits true when its element scrolls into view and false when it leaves, using IntersectionObserver.
 * Where that API is missing (very old browsers, jsdom), it emits nothing.
 *
 * Usage: `<section (appInView)="headlineVisible.set($event)">`.
 */
@Directive({ selector: '[appInView]' })
export class InViewDirective {
  /** Whether any part of the element is on screen. */
  readonly appInView = output<boolean>();

  constructor() {
    const element = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') return;
      const observer = new IntersectionObserver(([entry]) => this.appInView.emit(entry.isIntersecting));
      observer.observe(element);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
