import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aHousingCosts, aProjectionYear, aResponse } from '../../../../testing/builders';
import { fakeCharts } from '../../../../testing/fake-charts';
import { AmortizationResponse } from '../../../core/models/amortization.models';
import { CostProjectionComponent } from './cost-projection.component';

describe('CostProjectionComponent', () => {
  let fixture: ComponentFixture<CostProjectionComponent>;
  let charts: ReturnType<typeof fakeCharts>;

  beforeEach(() => {
    charts = fakeCharts();
    TestBed.configureTestingModule({ providers: [charts.provider] });
  });

  const render = (response: AmortizationResponse) => {
    fixture = TestBed.createComponent(CostProjectionComponent);
    fixture.componentRef.setInput('result', response);
    fixture.detectChanges();
    return fixture.componentInstance;
  };
  const showValue = () => {
    fixture.nativeElement.querySelector('[data-testid="projection-value"]').click();
    fixture.detectChanges();
  };
  const tooltip = () => charts.lastConfig().options!.plugins!.tooltip!.callbacks! as unknown as Record<string, (items: unknown) => string>;

  const rising = aResponse({
    projection: [
      aProjectionYear(1, { costs: aHousingCosts({ schoolTax: 2_000, hoaDues: 600 }), marketValue: 300_000, taxableValue: 300_000 }),
      aProjectionYear(2, { costs: aHousingCosts({ schoolTax: 2_200, hoaDues: 618 }), marketValue: 345_000, taxableValue: 330_000 }),
    ],
  });

  describe('yearly costs view', () => {
    it('draws one line per category that has any cost', () => {
      render(rising);

      expect(charts.lastConfig().data.datasets.map((d) => d.label)).toEqual(['School tax', 'HOA dues']);
      expect(charts.lastConfig().data.labels).toEqual(['Year 1', 'Year 2']);
    });

    it('labels the tooltip with the calendar year and adds a total', () => {
      render(rising);

      expect(tooltip()['title']([{ dataIndex: 1, label: 'Year 2' }])).toBe('Year 2 (from 2027)');
      expect(tooltip()['footer']([{ dataIndex: 1 }])).toBe('Total: $2,818');
    });

    it('summarizes how costs change from the first year to the last', () => {
      const component = render(rising);

      expect(component.note()).toBe('Yearly taxes & costs go from $2,600 in year 1 to $2,818 in year 2.');
    });
  });

  describe('home value view', () => {
    it('plots market value against a dashed taxable value', () => {
      render(rising);
      showValue();

      const [market, taxable] = charts.lastConfig().data.datasets;
      expect([market.label, taxable.label]).toEqual(['Market value', 'Taxable value']);
      expect(taxable.borderDash).toEqual([6, 4]);
      expect(tooltip()['title']([{ dataIndex: 0, label: 'Year 1' }])).toBe('Year 1 (from 2026)');
    });

    it('says how much value the cap keeps off the tax roll', () => {
      const component = render(rising);
      showValue();

      expect(component.note()).toBe('By year 2, the homestead cap keeps $15,000 of value off the tax roll.');
    });

    it('explains when taxable value simply tracks the market', () => {
      const component = render(aResponse());
      showValue();

      expect(component.note()).toContain('Taxable value tracks market value');
    });
  });

  it('shows no note when there is no projection', () => {
    const component = render(aResponse({ projection: [] }));

    expect(component.note()).toBe('');
  });
});
