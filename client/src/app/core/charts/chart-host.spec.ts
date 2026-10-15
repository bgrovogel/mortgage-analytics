import { Component, ElementRef, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Chart, type ChartConfiguration } from 'chart.js';
import { CHART_FACTORY } from './chart-factory';
import { hostChart } from './chart-host';
import { THEME_CHANGE } from '../layout/print';

/** A minimal component that owns a chart through hostChart, driven by a signal. */
@Component({ template: '<canvas #canvas></canvas>' })
class ChartHostComponent {
  readonly points = signal([1, 2, 3]);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    hostChart(
      () => this.canvas().nativeElement,
      () => ({ type: 'line', data: { datasets: [{ data: this.points() }] } }) as ChartConfiguration<'line'>,
    );
  }
}

describe('hostChart', () => {
  let createChart: jest.Mock;
  let themeListener: (() => void) | undefined;
  const removeListener = jest.fn();

  beforeEach(() => {
    createChart = jest.fn().mockImplementation(() => ({ destroy: jest.fn() }));
    removeListener.mockClear();
    window.matchMedia = jest.fn().mockReturnValue({
      addEventListener: (_: string, listener: () => void) => (themeListener = listener),
      removeEventListener: removeListener,
    });
    TestBed.configureTestingModule({ providers: [{ provide: CHART_FACTORY, useValue: createChart }] });
  });

  const render = () => {
    const fixture = TestBed.createComponent(ChartHostComponent);
    fixture.detectChanges();
    return fixture;
  };

  const lastChart = () => createChart.mock.results[createChart.mock.results.length - 1].value as { destroy: jest.Mock };

  it('redraws when the page switches theme to print', () => {
    render();

    window.dispatchEvent(new Event(THEME_CHANGE));

    expect(createChart).toHaveBeenCalledTimes(2);
  });

  it('draws the chart on the component canvas after rendering', () => {
    const fixture = render();

    expect(createChart).toHaveBeenCalledTimes(1);
    expect(createChart.mock.calls[0][0]).toBe(fixture.nativeElement.querySelector('canvas'));
  });

  it('redraws, destroying the old chart, when a signal it reads changes', () => {
    const fixture = render();
    const first = lastChart();

    fixture.componentInstance.points.set([4, 5]);
    fixture.detectChanges();

    expect(first.destroy).toHaveBeenCalled();
    expect(createChart).toHaveBeenCalledTimes(2);
    expect(createChart.mock.calls[1][1].data.datasets[0].data).toEqual([4, 5]);
  });

  it('redraws when the OS colour scheme changes, so colours follow light and dark mode', () => {
    render();

    themeListener!();

    expect(createChart).toHaveBeenCalledTimes(2);
  });

  it('destroys the chart and stops listening when the component is destroyed', () => {
    const fixture = render();
    const chart = lastChart();

    fixture.destroy();

    expect(chart.destroy).toHaveBeenCalled();
    expect(removeListener).toHaveBeenCalled();
    window.dispatchEvent(new Event(THEME_CHANGE));
    expect(createChart).toHaveBeenCalledTimes(1); // no longer redrawn for printing
  });
});

describe('CHART_FACTORY (default)', () => {
  it('creates a real Chart.js chart', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined); // jsdom has no 2D context
    const create = TestBed.inject(CHART_FACTORY);

    const chart = create(document.createElement('canvas'), { type: 'line', data: { datasets: [] } });

    expect(chart).toBeInstanceOf(Chart);
    chart.destroy();
  });
});
