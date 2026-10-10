import { TestBed } from '@angular/core/testing';
import { aRefinanceOption, aRefinanceResponse } from '../../../../testing/builders';
import { fakeCharts } from '../../../../testing/fake-charts';
import { RefinanceResponse } from '../../../core/models/refinance.models';
import { RefinanceChartComponent } from './refinance-chart.component';

describe('RefinanceChartComponent', () => {
  const render = (result: RefinanceResponse) => {
    const charts = fakeCharts();
    TestBed.configureTestingModule({ providers: [charts.provider] });
    const fixture = TestBed.createComponent(RefinanceChartComponent);
    fixture.componentRef.setInput('result', result);
    fixture.detectChanges();
    return charts.lastConfig();
  };

  it('plots each option\'s balance over the longest schedule, holding at $0 once paid off', () => {
    const config = render(aRefinanceResponse({
      current: aRefinanceOption({}, 2),
      refinanced: aRefinanceOption({}, 4),
      keepingCurrentPayment: aRefinanceOption({}, 3),
    }));

    expect(config.data.labels).toEqual(['Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026']);
    expect(config.data.datasets.map((d) => [d.label, d.data])).toEqual([
      ['Current loan', [100, 0, 0, 0]],
      ['Refinance', [300, 200, 100, 0]],
      ['Refinance, keep payment', [200, 100, 0, 0]],
    ]);
  });

  it('leaves out the keep-payment line when that option does not apply', () => {
    const config = render(aRefinanceResponse({ keepingCurrentPayment: null }));

    expect(config.data.datasets.map((d) => d.label)).toEqual(['Current loan', 'Refinance']);
  });
});
