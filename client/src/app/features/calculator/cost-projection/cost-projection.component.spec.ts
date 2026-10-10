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
  // The view is chosen by the tabs around the chart.
  const showValue = () => {
    fixture.componentRef.setInput('view', 'value');
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
    it('stacks the categories as areas, so the top edge is the total cost', () => {
      render(rising);

      expect(charts.lastConfig().options!.scales!['y']!.stacked).toBe(true);
    });

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
    it('plots the home value, the capped assessed value, and what each tax is charged on', () => {
      render(aResponse({ projection: [
        aProjectionYear(1, { marketValue: 300_000, assessedValue: 300_000, schoolTaxableValue: 160_000 }),
        aProjectionYear(2, { marketValue: 345_000, assessedValue: 330_000, schoolTaxableValue: 190_000 }),
      ] }));
      showValue();

      expect(charts.lastConfig().data.datasets.map((d) => d.label)).toEqual(['Market value', 'Assessed value (capped)', 'School taxable value']);
      expect(charts.lastConfig().options!.scales!['y']!.stacked).toBeFalsy(); // values are compared, not added
      expect(tooltip()['title']([{ dataIndex: 0, label: 'Year 1' }])).toBe('Year 1 (from 2026)');
    });

    it('explains what each tax is charged on', () => {
      const component = render(aResponse({ projection: [aProjectionYear(1, { schoolTaxableValue: 110_000 })] }));
      showValue();

      expect(component.note()).toBe('In year 1, after homestead exemptions, school tax is charged on $110,000.');
    });
  });

  it('names the chart for the view shown, and draws a new chart when the view changes', () => {
    render(rising);
    const caption = () => fixture.nativeElement.querySelector('figcaption').textContent.trim();
    expect(caption()).toBe('Projected yearly taxes & costs');

    showValue();

    expect(caption()).toBe('Home value, and what each tax is charged on');
    expect(charts.count()).toBe(2);
  });

  it('shows no note when there is no projection', () => {
    const component = render(aResponse({ projection: [] }));

    expect(component.note()).toBe('');
  });
});
