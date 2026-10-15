import { DestroyRef, ElementRef, afterRenderEffect, inject } from '@angular/core';
import { type ChartConfiguration } from 'chart.js';
import { CHART_FACTORY, ChartHandle } from './chart-factory';
import { THEME_CHANGE } from '../layout/print';

/**
 * Owns one chart for a component: rebuilds it when the component's inputs change, the OS theme flips or the page
 * switches theme to print, and destroys it with the component. Call from a constructor (injection context).
 * @param canvas Returns the canvas to draw on.
 * @param config Builds the configuration; it may read signals, which re-renders the chart when they change.
 */
export function hostChart(
  canvas: () => HTMLCanvasElement,
  config: (host: HTMLElement) => ChartConfiguration<'line'>,
): void {
  const host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
  const createChart = inject(CHART_FACTORY);
  let chart: ChartHandle | undefined;

  const render = () => {
    const next = config(host);
    chart?.destroy();
    chart = createChart(canvas(), next);
  };

  afterRenderEffect(render);

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', render);
  window.addEventListener(THEME_CHANGE, render);

  inject(DestroyRef).onDestroy(() => {
    media.removeEventListener('change', render);
    window.removeEventListener(THEME_CHANGE, render);
    chart?.destroy();
  });
}
