import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { decimal, usd, usdCents } from '../../../core/formatting/format';
import { DialogComponent } from '../../../core/layout/dialog.component';
import { AmortizationResponse } from '../../../core/models/amortization.models';
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
  protected readonly cents = usdCents;
  protected readonly whole = usd;
  protected readonly pct = (value: number) => decimal(value, 3);
  protected readonly rate = (value: number) => decimal(value, 4);
}
