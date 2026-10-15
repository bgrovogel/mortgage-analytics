import { TestBed } from '@angular/core/testing';
import type { ScheduleColumn, ScheduleRow } from './schedule-model';
import { ScheduleTotalsComponent } from './schedule-totals.component';

describe('ScheduleTotalsComponent', () => {
  const totals = {
    number: 0, when: '', scheduledPayment: 0, principal: 319_650, interest: 355_963.9, extraPrincipal: 58_000,
    costs: {}, housingCosts: 0, totalOutlay: 1_059_371.9, remainingBalance: 0, pmiEnds: false, recast: false,
  } as unknown as ScheduleRow;
  const columns: ScheduleColumn[] = [
    { key: 'principal', label: 'Principal', value: (r) => r.principal },
    { key: 'interest', label: 'Interest', value: (r) => r.interest },
    { key: 'extraPrincipal', label: 'Extra', value: (r) => r.extraPrincipal },
    { key: 'totalOutlay', label: 'Total', value: (r) => r.totalOutlay },
  ];

  const render = () => {
    const fixture = TestBed.createComponent(ScheduleTotalsComponent);
    fixture.componentRef.setInput('totals', totals);
    fixture.componentRef.setInput('columns', columns);
    fixture.componentRef.setInput('payments', 291);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const text = (id: string) => root.querySelector(`[data-testid="${id}"]`)!.textContent!.replace(/\s+/g, ' ').trim();
    return { root, text };
  };

  it('leads with the three figures that matter, and says what they cover', () => {
    const { text } = render();

    expect(text('lifetime-headline')).toBe('Loan repaid $377,650.00 Interest $355,963.90 Everything paid $1,059,371.90');
    expect(text('lifetime-scope')).toBe('Totals until the loan is paid off, after 291 payments. Taxes and insurance are counted to that date only.');
  });

  it('keeps every total one step away, closed until asked for, and names the parts for what they are', () => {
    const { root, text } = render();

    expect((root.querySelector('[data-testid="lifetime-more"]') as HTMLDetailsElement).open).toBe(false);
    const every = text('lifetime-totals');
    expect(every).toContain('Principal, as scheduled $319,650.00');
    expect(every).toContain('Extra principal $58,000.00');
    expect(every).toContain('Everything paid $1,059,371.90');
  });
});
