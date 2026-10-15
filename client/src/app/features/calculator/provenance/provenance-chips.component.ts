import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { decimal, monthOf, usd, usdCents } from '../../../core/formatting/format';
import { DialogComponent } from '../../../core/layout/dialog.component';
import { AmortizationResponse } from '../../../core/models/amortization.models';
import { icsCalendar, milestones } from './milestones';
import { paymentMath } from './payment-math';

/**
 * Under the headline number, where it comes from, as a receipt rather than a badge (UI blueprint, pillar 4): that the
 * schedule is exact to the cent and ends at $0.00, and a way into the arithmetic behind the payment ("Show the math").
 * It states only what the schedule shows: nothing here is a claim the numbers do not carry.
 */
@Component({
  selector: 'app-provenance-chips',
  imports: [DialogComponent],
  template: `
    @let m = math();
    <div class="chips">
      @if (m?.endsAtZero) {
        <span class="chip" data-testid="exact-chip">
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.8" /><path d="m5.5 8 1.8 1.8L11 6.2" fill="none" stroke="currentColor" stroke-width="1.8" /></svg>
          Exact to the cent · ends at $0.00
        </span>
      }
      <button type="button" class="chip action" data-testid="key-dates" (click)="dates.open()">
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.8" /><path d="M2 7h12M5.5 1.5v3M10.5 1.5v3" fill="none" stroke="currentColor" stroke-width="1.8" /></svg>
        Key dates
      </button>
      <app-dialog #dates heading="Dates you act on">
        <ol class="dates" data-testid="dates">
          @for (item of dateItems(); track item.id) {
            <li>
              <span class="mark" [attr.data-id]="item.id" aria-hidden="true"></span>
              <div><span class="what">{{ item.title }}</span><span class="detail">{{ item.detail }}</span></div>
              <span class="when">{{ monthOf(item.date) }}</span>
            </li>
          }
        </ol>
        <button type="button" class="download" data-testid="download-ics" (click)="download()">Add all to calendar (.ics)</button>
      </app-dialog>
      @if (m) {
        <button type="button" class="chip action" data-testid="show-math" (click)="dialog.open()">
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16"><path d="M2 13 6 7l3 3 5-7" fill="none" stroke="currentColor" stroke-width="1.8" /></svg>
          Show the math
        </button>
        <app-dialog #dialog [heading]="'How ' + cents(m.payment) + ' a month is worked out'">
          <div class="math" data-testid="math">
            <p>The payment is the same every month, set so that the balance reaches exactly zero at the last one:</p>
            <p class="formula">payment = balance × r ÷ (1 − (1 + r)<sup>−n</sup>)</p>
            <dl>
              <div><dt>balance</dt><dd>{{ whole(m.balance) }}</dd></div>
              <div><dt>r</dt><dd>{{ pct(m.annualRatePercent) }}% ÷ 12 = {{ rate(m.monthlyRatePercent) }}% a month</dd></div>
              <div><dt>n</dt><dd>{{ m.payments }} payments</dd></div>
              <div class="result"><dt>payment</dt><dd>{{ cents(m.payment) }}</dd></div>
            </dl>
            <p>
              The first month, as the schedule shows it: the interest is the balance times r, {{ cents(m.firstInterest) }};
              the rest of the payment, {{ cents(m.firstPrincipal) }}, pays the loan down. Each month's interest is rounded to the
              cent, and the last payment clears what is left to $0.00.
            </p>
          </div>
        </app-dialog>
      }
    </div>
  `,
  styleUrl: './provenance-chips.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProvenanceChipsComponent {
  /** The analysis whose payment is explained. */
  readonly result = input.required<AmortizationResponse>();

  protected readonly math = computed(() => paymentMath(this.result()));
  protected readonly dateItems = computed(() => milestones(this.result()));
  protected readonly monthOf = monthOf;

  /** Saves the key dates as a calendar file, one all-day event for each. */
  protected download(): void {
    const url = URL.createObjectURL(new Blob([icsCalendar(this.dateItems(), 'mortgage-analytics')], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mortgage-key-dates.ics';
    link.click();
    URL.revokeObjectURL(url);
  }
  protected readonly cents = usdCents;
  protected readonly whole = usd;
  protected readonly pct = (value: number) => decimal(value, 3);
  protected readonly rate = (value: number) => decimal(value, 4);
}
