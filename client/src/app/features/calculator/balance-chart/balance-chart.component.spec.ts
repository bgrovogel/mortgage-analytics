import { TestBed } from '@angular/core/testing';
import { aPayment, aResponse, aSchedule } from '../../../../testing/builders';
import { fakeCharts } from '../../../../testing/fake-charts';
import { BalanceChartComponent } from './balance-chart.component';

describe('BalanceChartComponent', () => {
  it('plots the standard and accelerated balances, labelled by month', () => {
    const charts = fakeCharts();
    TestBed.configureTestingModule({ providers: [charts.provider] });
    const fixture = TestBed.createComponent(BalanceChartComponent);
    fixture.componentRef.setInput('result', aResponse({
      baseline: aSchedule({ payments: [aPayment(1, { remainingBalance: 2_000 }), aPayment(2, { remainingBalance: 0 })] }),
      accelerated: aSchedule({ payments: [aPayment(1, { remainingBalance: 0 })] }),
    }));

    fixture.detectChanges();

    const config = charts.lastConfig();
    const title = (config.options!.plugins!.tooltip!.callbacks as unknown as Record<string, (items: unknown) => string>)['title'];
    expect(config.data.datasets.map((d) => [d.label, d.data])).toEqual([
      ['Standard payoff', [2_000, 0]],
      ['With extra payments', [0]],
    ]);
    expect(config.data.labels).toEqual(['Jan 2026', 'Feb 2026']);
    expect(title([{ dataIndex: 1, label: 'Feb 2026' }])).toBe('Payment 2 · Feb 2026');
  });
});
