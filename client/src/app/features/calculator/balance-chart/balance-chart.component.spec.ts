import { TestBed } from '@angular/core/testing';
import { aPayment, aResponse, aSavings, aSchedule } from '../../../../testing/builders';
import { AmortizationResponse } from '../../../core/models/amortization.models';
import { BalanceChartComponent, GHOST_MS } from './balance-chart.component';

/** A 120-payment loan of $120,000 paying $1,000 of principal and $400 of interest a month. */
const loan = (months = 120, extra = 0) => aSchedule({
  payments: Array.from({ length: months }, (_, i) => aPayment(i + 1, {
    dueDate: `${2026 + Math.floor((10 + i) / 12)}-${String(((10 + i) % 12) + 1).padStart(2, '0')}-01`,
    scheduledPayment: 1_400, principal: 1_000, extraPrincipal: extra, interest: 400,
    remainingBalance: Math.max(0, 120_000 - (i + 1) * (1_000 + extra)),
  })),
});

describe('BalanceChartComponent', () => {
  const render = (response: AmortizationResponse) => {
    const fixture = TestBed.createComponent(BalanceChartComponent);
    fixture.componentRef.setInput('result', response);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const text = (id: string) => root.querySelector(`[data-testid="${id}"]`)?.textContent?.replace(/\s+/g, ' ').trim();
    const scrub = (value: number) => {
      const input = root.querySelector('[data-testid="scrubber"]') as HTMLInputElement;
      input.value = String(value);
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    return { fixture, root, text, scrub };
  };

  const withExtra = () => aResponse({ baseline: loan(120), accelerated: loan(80, 500), savings: aSavings({ paymentsSaved: 40 }) });

  it('says in a sentence what the chart shows, and draws both curves', () => {
    const { root, text } = render(withExtra());

    expect(text('balance-summary')).toBe('Paying extra clears the loan in Jun 2033, 3 yr 4 mo sooner than scheduled.');
    expect(root.querySelector('svg[data-testid="balance-chart"]')!.getAttribute('role')).toBe('img');
    expect(root.querySelector('[data-testid="balance-extra"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="balance-scheduled"]')).not.toBeNull();
  });

  it('draws one curve, and says when the loan ends, when nothing extra is paid', () => {
    const { root, text } = render(aResponse({ baseline: loan(120), accelerated: loan(120) }));

    expect(root.querySelector('[data-testid="balance-scheduled"]')).toBeNull();
    expect(text('balance-summary')).toBe('The loan runs until Oct 2036.');
  });

  describe('as a table', () => {
    const rows = (root: HTMLElement) => [...root.querySelectorAll('[data-testid="balance-table"] tbody tr')]
      .map((tr) => [...tr.querySelectorAll('th, td')].map((c) => c.textContent!.replace(/\s+/g, ' ').trim()).join(' | '));

    it('offers the balance after every year of payments, both ways, for anyone who would rather read than see it', () => {
      const { fixture, root } = render(withExtra());
      const toggle = () => root.querySelector('[data-testid="balance-as-table"]') as HTMLButtonElement;
      expect(root.querySelector('[data-testid="balance-table"]')).toBeNull();

      toggle().click();
      fixture.detectChanges();

      const found = rows(root);
      expect(found).toHaveLength(10);
      expect(found[0]).toBe('Oct 2027 · payment 12 | $102,000 | $108,000 | $4,800');
      expect(found[9]).toBe('Oct 2036 · payment 120 | $0 | $0 | $32,000');
      expect(root.querySelector('svg[data-testid="balance-chart"]')).toBeNull();
      expect(toggle().textContent!.trim()).toBe('View as chart');

      toggle().click();
      fixture.detectChanges();

      expect(root.querySelector('svg[data-testid="balance-chart"]')).not.toBeNull();
    });

    it('has one balance column when nothing extra is paid', () => {
      const { fixture, root } = render(aResponse({ baseline: loan(120), accelerated: loan(120) }));

      (root.querySelector('[data-testid="balance-as-table"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect([...root.querySelectorAll('[data-testid="balance-table"] thead th')].map((c) => c.textContent!.trim()))
        .toEqual(['After', 'You owe', 'Interest paid so far']);
    });
  });

  it('offers the time frames that fit the loan, the full term chosen at first', () => {
    const { root } = render(withExtra());
    const frames = [...root.querySelectorAll('[data-testid="frames"] button')].map((b) => [b.textContent!.trim(), b.getAttribute('aria-pressed')]);

    expect(frames).toEqual([['5Y', 'false'], ['To payoff', 'false'], ['10Y', 'true']]);
  });

  it('narrows to a time frame, and the scrubber follows its length', () => {
    const { fixture, root } = render(withExtra());

    (root.querySelector('[data-testid="frame-5y"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect((root.querySelector('[data-testid="scrubber"]') as HTMLInputElement).max).toBe('60');
    expect(root.querySelector('[data-testid="frame-5y"]')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('reads the balances at the month scrubbed to: on the chart, in the tooltip and to a screen reader', () => {
    const { root, text, scrub } = render(withExtra());

    scrub(24);

    expect(text('scrub-date')).toBe('Oct 2028 · payment 24');
    expect(text('scrub-extra')).toBe('$84,000');
    expect(text('scrub-scheduled')).toBe('$96,000');
    expect(text('scrub-gap')).toBe('$12,000');
    expect(text('scrub-interest')).toBe('$9,600');
    expect((root.querySelector('[data-testid="scrubber"]') as HTMLInputElement).getAttribute('aria-valuetext'))
      .toBe('Payment 24, Oct 2028: you owe $84,000 with extra, $96,000 on schedule');
  });

  it('moves a year at a time with Page Up and Page Down', () => {
    const { fixture, root, scrub, text } = render(withExtra());
    scrub(24);
    const input = root.querySelector('[data-testid="scrubber"]') as HTMLInputElement;

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }));
    fixture.detectChanges();
    expect(text('scrub-date')).toBe('Oct 2029 · payment 36');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
    fixture.detectChanges();
    expect(text('scrub-date')).toBe('Oct 2027 · payment 12');
  });

  describe('the ghost of the result before an edit', () => {
    /** The same loan at another rate: a faster payoff and a different first-payment rate. */
    const withRate = (schedule: ReturnType<typeof loan>, rate: number) => ({ ...schedule, payments: schedule.payments.map((p) => ({ ...p, annualInterestRate: rate })) });
    const edited = () => aResponse({
      baseline: withRate(loan(120), 5.75),
      accelerated: aSchedule({
        payments: loan(70, 600).payments.map((p) => ({ ...p, annualInterestRate: 5.75 })),
        totalInterest: 20_000,
      }),
      savings: aSavings({ paymentsSaved: 50 }),
    });
    const first = () => aResponse({
      baseline: withRate(loan(120), 6.25),
      accelerated: aSchedule({
        payments: loan(80, 500).payments.map((p) => ({ ...p, annualInterestRate: 6.25 })),
        totalInterest: 24_000,
      }),
      savings: aSavings({ paymentsSaved: 40 }),
    });

    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('keeps the previous curve faintly, with what the edit changed in a chip, then lets it go', () => {
      const { fixture, root, text } = render(first());
      expect(root.querySelector('[data-testid="balance-ghost"]')).toBeNull();

      fixture.componentRef.setInput('result', edited());
      fixture.detectChanges();

      expect(root.querySelector('[data-testid="balance-ghost"]')).not.toBeNull();
      expect(text('ghost-chip')).toBe('6.25% → 5.75% · −$4,000 interest Pin');

      jest.advanceTimersByTime(GHOST_MS);
      fixture.detectChanges();
      expect(root.querySelector('[data-testid="balance-ghost"]')).toBeNull();
      expect(root.querySelector('[data-testid="ghost-chip"]')).toBeNull();
    });

    it('keeps it for good when pinned, until it is unpinned', () => {
      const { fixture, root, text } = render(first());
      fixture.componentRef.setInput('result', edited());
      fixture.detectChanges();

      (root.querySelector('[data-testid="ghost-chip"]') as HTMLButtonElement).click();
      jest.advanceTimersByTime(GHOST_MS * 3);
      fixture.detectChanges();
      expect(root.querySelector('[data-testid="balance-ghost"]')).not.toBeNull();
      expect(text('ghost-chip')).toContain('Pinned · Unpin');

      (root.querySelector('[data-testid="ghost-chip"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(root.querySelector('[data-testid="balance-ghost"]')).toBeNull();
    });
  });

  it('lists the payments from the month scrubbed to, in the ledger beneath', () => {
    const { root, scrub } = render(withExtra());

    scrub(10);
    const rows = [...root.querySelectorAll('[data-testid="ledger"] tbody tr')].map((tr) => [...tr.children].map((c) => c.textContent!.trim()));

    expect(rows).toHaveLength(6);
    expect(rows[0]).toEqual(['Aug 2027', '1,900.00', '1,500.00', '400.00', '105,000.00']);
    expect(rows[5][0]).toBe('Jan 2028');
  });
});
