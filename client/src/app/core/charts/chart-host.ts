import { DestroyRef, ElementRef, afterRenderEffect, inject } from '@angular/core';
import { Chart, type ChartConfiguration } from 'chart.js';

/**
 * Owns one Chart.js instance for a component: rebuilds it when the component's inputs change or the
 * OS theme flips, and destroys it with the component. Call from a constructor (injection context).
 * @param canvas Returns the canvas to draw on.
 * @param config Builds the configuration; it may read signals, which re-renders the chart when they change.
 */
export function hostChart(
  canvas: () => HTMLCanvasElement,
  config: (host: HTMLElement) => ChartConfiguration<'line'>,
): void {
  const host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
  let chart: Chart<'line'> | undefined;

  const render = () => {
    const next = config(host);
    chart?.destroy();
    chart = new Chart(canvas(), next);
  };

  afterRenderEffect(render);

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', render);

  inject(DestroyRef).onDestroy(() => {
    media.removeEventListener('change', render);
    chart?.destroy();
  });
}
