import { type ChartConfiguration } from 'chart.js';
import { CHART_FACTORY } from '../app/core/charts/chart-factory';

/**
 * A fake chart factory for component tests (jsdom has no canvas). It records every chart a component
 * creates, so a test can inspect the configuration the component built.
 */
export function fakeCharts() {
  const create = jest.fn((_canvas: HTMLCanvasElement, _config: ChartConfiguration<'line'>) => ({ destroy: jest.fn() }));
  return {
    /** Provide this in TestBed. */
    provider: { provide: CHART_FACTORY, useValue: create },
    /** The configuration of the most recently created chart. */
    lastConfig: () => create.mock.calls[create.mock.calls.length - 1][1],
    /** How many charts have been created so far. */
    count: () => create.mock.calls.length,
  };
}
