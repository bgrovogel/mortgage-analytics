import { InjectionToken } from '@angular/core';
import { Chart, type ChartConfiguration } from 'chart.js';

/** The part of a chart instance the app relies on. */
export interface ChartHandle {
  destroy(): void;
}

/** Creates a chart on a canvas. */
export type ChartFactory = (canvas: HTMLCanvasElement, config: ChartConfiguration<'line'>) => ChartHandle;

/**
 * How charts are created. The default draws a real Chart.js chart; tests provide a fake, because
 * jsdom has no canvas. Injecting the constructor (rather than calling `new Chart` directly) is the
 * same dependency-inversion seam the API uses for its clock.
 */
export const CHART_FACTORY = new InjectionToken<ChartFactory>('ChartFactory', {
  providedIn: 'root',
  factory: () => (canvas, config) => new Chart(canvas, config),
});
