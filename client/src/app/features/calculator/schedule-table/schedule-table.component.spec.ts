import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aHousingCosts, aPayment, aResponse, aSchedule } from '../../../../testing/builders';
import { AmortizationResponse } from '../../../core/models/amortization.models';
import { ScheduleTableComponent } from './schedule-table.component';

describe('ScheduleTableComponent', () => {
  let fixture: ComponentFixture<ScheduleTableComponent>;

  beforeEach(() => localStorage.clear());

  const render = (response: AmortizationResponse) => {
    fixture = TestBed.createComponent(ScheduleTableComponent);
    fixture.componentRef.setInput('result', response);
    fixture.detectChanges();
    return fixture.componentInstance;
  };
  const rows = () => fixture.nativeElement.querySelectorAll('tbody tr') as NodeListOf<HTMLTableRowElement>;
  const headers = () => [...fixture.nativeElement.querySelectorAll('thead th')].map((th: Element) => th.textContent?.trim());
  const click = (testId: string) => {
    fixture.nativeElement.querySelector(`[data-testid="${testId}"]`).click();
    fixture.detectChanges();
  };

  const response = aResponse({ baseline: aSchedule({}, 5), accelerated: aSchedule({}, 3) });

  it('shows the accelerated schedule by default', () => {
    render(response);

    expect(rows()).toHaveLength(3);
  });

  it('switches between the accelerated and standard schedules', () => {
    const component = render(response);

    click('view-baseline');
    expect(component.view()).toBe('baseline');
    expect(rows()).toHaveLength(5);

    click('view-accelerated');
    expect(rows()).toHaveLength(3);
  });

  it('hides the taxes and total columns when there are no housing costs', () => {
    const component = render(response);

    expect(component.hasHousingCosts()).toBe(false);
    expect(headers()).not.toContain('Total');
  });

  it('adds the taxes and total columns, and tags the payment where PMI ends, not every month that has it', () => {
    const pmi = { housingCosts: 100, costs: aHousingCosts({ mortgageInsurance: 100 }) };
    const accelerated = aSchedule({
      totalHousingCosts: aHousingCosts({ mortgageInsurance: 200 }),
      payments: [aPayment(1, pmi), aPayment(2, pmi), aPayment(3, { housingCosts: 0 })],
    });
    render(aResponse({ accelerated }));

    expect(headers()).toEqual(expect.arrayContaining(['Housing costs', 'Total']));
    expect([...rows()].map((r) => r.querySelector('[data-testid="pmi-ends-tag"]')?.textContent?.trim() ?? null)).toEqual([null, 'PMI ends', null]);
  });

  it("tags where an FHA loan's MIP ends, by that name", () => {
    const mip = { housingCosts: 100, costs: aHousingCosts({ mortgageInsurance: 100 }) };
    const accelerated = aSchedule({
      totalHousingCosts: aHousingCosts({ mortgageInsurance: 100 }),
      payments: [aPayment(1, mip), aPayment(2, { housingCosts: 0 })],
    });
    render(aResponse({ accelerated, program: { type: 'Fha', upfrontFeePercent: 1.75, upfrontFee: 1_750, upfrontFeeFinanced: true, loanAmount: 101_750, annualMipPercent: 0.55, mipPayments: 1 } }));

    expect(fixture.nativeElement.querySelector('[data-testid="pmi-ends-tag"]').textContent.trim()).toBe('MIP ends');
  });

  describe('downloading as a spreadsheet', () => {
    let blobs: Blob[];
    let clicked: HTMLAnchorElement[];

    beforeEach(() => {
      blobs = [];
      clicked = [];
      URL.createObjectURL = jest.fn((blob: Blob) => {
        blobs.push(blob);
        return 'blob:schedule';
      });
      URL.revokeObjectURL = jest.fn();
      jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        clicked.push(this);
      });
    });
    afterEach(() => jest.restoreAllMocks());

    const textOf = (blob: Blob) =>
      new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(blob);
      });

    it('saves every payment of the schedule shown, with the columns it has, as a file named for it', async () => {
      render(response);

      click('download-csv');

      expect(clicked).toHaveLength(1);
      expect(clicked[0].download).toBe('payment-schedule-monthly-with-extra-payments.csv');
      expect(clicked[0].href).toBe('blob:schedule');
      expect(blobs[0].type).toBe('text/csv;charset=utf-8');
      const lines = (await textOf(blobs[0])).split('\r\n');
      expect(lines[0]).toBe('#,Date,Payment,Principal,Interest,Extra,Balance');
      expect(lines).toHaveLength(3 + 2);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:schedule');
    });

    it('follows the rows and the schedule chosen, and names the file for them', async () => {
      render(response);
      click('view-yearly');
      click('view-baseline');

      click('download-csv');

      expect(clicked[0].download).toBe('payment-schedule-yearly-standard.csv');
      expect((await textOf(blobs[0])).split('\r\n')[0]).toBe('Year,Starts,Payment,Principal,Interest,Extra,Balance');
    });

    it('includes the columns that are hidden from the table: a spreadsheet can hide its own', async () => {
      const component = render(response);
      component.toggle('interest');
      fixture.detectChanges();
      expect(headers()).not.toContain('Interest');

      click('download-csv');

      expect((await textOf(blobs[0])).split('\r\n')[0]).toContain('Interest');
    });
  });

  describe('yearly view', () => {
    /** Two loan years: 24 payments of $1,000 ($600 principal, $400 interest), $100 extra on payment 13. */
    const twoYears = () => aResponse({
      accelerated: aSchedule({
        payments: Array.from({ length: 24 }, (_, i) =>
          aPayment(i + 1, { extraPrincipal: i === 12 ? 100 : 0, remainingBalance: 24_000 - (i + 1) * 600, housingCosts: 50, totalOutlay: i === 12 ? 1_150 : 1_050 })),
        totalHousingCosts: aHousingCosts({ hoaDues: 1_200 }),
      }),
    });

    it('shows monthly rows by default', () => {
      render(twoYears());

      expect(rows()).toHaveLength(24);
    });

    it('rolls the payments up into one row per loan year', () => {
      render(twoYears());
      click('view-yearly');

      expect(rows()).toHaveLength(2);
      expect(headers()[0]).toBe('Year');
      const year2 = [...rows()[1].querySelectorAll('td')].map((td) => td.textContent?.trim());
      expect(year2).toEqual(['2', '2027', '$12,000.00', '$7,200.00', '$4,800.00', '$100.00', '$600.00', '$12,700.00', '$9,600.00']);
    });

    it('switches back to monthly rows', () => {
      render(twoYears());
      click('view-yearly');
      click('view-monthly');

      expect(rows()).toHaveLength(24);
    });
  });

  it('totals every money column, each under its own header', () => {
    const accelerated = aSchedule({
      payments: [aPayment(1, { extraPrincipal: 100, housingCosts: 50, totalOutlay: 1_150 }), aPayment(2, { housingCosts: 50, totalOutlay: 1_050 })],
      totalHousingCosts: aHousingCosts({ hoaDues: 100 }),
    });
    render(aResponse({ accelerated }));

    const footer = [...fixture.nativeElement.querySelectorAll('tfoot td')].map((td: Element) => td.textContent?.trim());
    expect(footer).toEqual(['$2,000.00', '$1,200.00', '$800.00', '$100.00', '$100.00', '$2,200.00', '']);
  });

  it('pins the first two columns, so they stay put when the table scrolls sideways on a phone', () => {
    render(response);

    expect(fixture.nativeElement.querySelector('thead th').classList).toContain('pinned');
  });

  it('shows extra principal, a dash when there is none, and tags the payment that triggered a recast', () => {
    const accelerated = aSchedule({
      payments: [aPayment(1), aPayment(2, { extraPrincipal: 25_000 })],
      recasts: [{ afterPaymentNumber: 2, effectiveDate: '2026-03-01', previousPayment: 1_000, newPayment: 800, fee: 250 }],
    });
    const component = render(aResponse({ accelerated }));

    expect(component.recastAfter().has(2)).toBe(true);
    expect(rows()[0].textContent).toContain('—');
    expect(rows()[1].textContent).toContain('$25,000.00');
    expect(rows()[1].querySelector('[data-testid="recast-tag"]')).not.toBeNull();
  });

  describe('choosing columns', () => {
    /** Two payments with school tax and HOA dues, $150 a month in all. */
    const withCosts = () => aResponse({
      accelerated: aSchedule({
        totalHousingCosts: aHousingCosts({ schoolTax: 200, hoaDues: 100 }),
        payments: [1, 2].map((n) =>
          aPayment(n, { costs: aHousingCosts({ schoolTax: 100, hoaDues: 50 }), housingCosts: 150, totalOutlay: 1_150 })),
      }),
    });
    const picker = () => fixture.nativeElement.querySelector('[data-testid="column-picker"]') as HTMLElement;
    const options = () => [...picker().querySelectorAll('label')].map((l) => l.textContent!.trim());
    const toggle = (label: string) => {
      const option = [...picker().querySelectorAll('label')].find((l) => l.textContent!.trim() === label)!;
      option.querySelector('input')!.click();
      fixture.detectChanges();
    };
    const footer = () => [...fixture.nativeElement.querySelectorAll('tfoot td')].map((td: Element) => td.textContent?.trim());

    it('offers every money column, and each cost this loan actually has', () => {
      render(withCosts());

      expect(options()).toEqual(['Principal', 'Interest', 'Extra', 'School tax', 'HOA dues', 'Housing costs', 'Total']);
    });

    it('starts with the costs rolled up into one Housing costs column', () => {
      render(withCosts());

      expect(headers()).toEqual(['#', 'Date', 'Payment', 'Principal', 'Interest', 'Extra', 'Housing costs', 'Total', 'Balance']);
    });

    it('adds a cost as its own column, with its own total', () => {
      render(withCosts());

      toggle('School tax');

      expect(headers()).toContain('School tax');
      expect(rows()[0].textContent).toContain('$100.00');
      expect(footer()).toContain('$200.00');
    });

    it('hides a column that is unticked', () => {
      render(withCosts());

      toggle('Principal');

      expect(headers()).not.toContain('Principal');
    });

    it('remembers the choice the next time the table is shown', () => {
      render(withCosts());
      toggle('HOA dues');

      render(withCosts());

      expect(headers()).toContain('HOA dues');
    });

    it('still works where browser storage is blocked', () => {
      const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      render(withCosts());

      expect(() => toggle('HOA dues')).not.toThrow();
      expect(headers()).toContain('HOA dues');
      setItem.mockRestore();
    });

    it('sums up the whole schedule, every cost included, whatever the columns', () => {
      render(withCosts());
      const totals = fixture.nativeElement.querySelector('[data-testid="lifetime-totals"]').textContent.replace(/\s+/g, ' ');

      expect(totals).toContain('Interest $800.00');
      expect(totals).toContain('School tax $200.00');
      expect(totals).toContain('HOA dues $100.00');
      expect(totals).toContain('Everything paid $2,300.00');
    });
  });
});
