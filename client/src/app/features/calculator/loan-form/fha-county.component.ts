import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { FhaLimitsService } from '../../../core/services/fha-limits.service';

/**
 * Where an FHA home is: a state, then one of its counties, from HUD's table. It sets the county's FIPS code on the
 * form, says the most FHA insures there, and warns when the loan is over it (the API refuses such a loan too).
 */
@Component({
  selector: 'app-fha-county',
  imports: [ReactiveFormsModule, CurrencyPipe],
  template: `
    @if (limits(); as l) {
      <div class="row">
        <label class="field">
          <span>State</span>
          <select data-testid="fha-state" [value]="state()" (change)="chooseState($any($event.target).value)">
            <option value="">Choose a state</option>
            @for (s of states(); track s.code) {
              <option [value]="s.code" [selected]="s.code === state()">{{ s.name }}</option>
            }
          </select>
        </label>
        <label class="field">
          <span>County</span>
          <select data-testid="fha-county" [formControl]="county()" [attr.disabled]="state() ? null : true">
            <option value="">Choose a county</option>
            @for (c of counties(); track c.fips) {
              <option [value]="c.fips">{{ c.name }}</option>
            }
          </select>
        </label>
      </div>
      @if (chosen(); as c) {
        <p class="hint" data-testid="fha-limit">FHA's {{ l.year }} limit in {{ c.name }}, {{ c.state }}: {{ c.limit | currency: 'USD' : 'symbol' : '1.0-0' }}.</p>
        @if (loanAmount() > c.limit) {
          <small class="error" data-testid="fha-over-limit">
            This loan, {{ loanAmount() | currency: 'USD' : 'symbol' : '1.0-0' }}, is over it: put more down, or choose another loan type.
          </small>
        }
      } @else {
        <p class="hint">Optional: the county sets the most FHA insures there ({{ l.floor | currency: 'USD' : 'symbol' : '1.0-0' }} in most).</p>
      }
    }
  `,
  styleUrl: './fha-county.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FhaCountyComponent {
  /** The form's county control, holding the five-digit FIPS code ('' for none). */
  readonly county = input.required<FormControl<string>>();

  /** The base loan, to warn when it is over the county's limit. */
  readonly loanAmount = input.required<number>();

  /** HUD's table, once it has arrived. */
  protected readonly limits = toSignal(inject(FhaLimitsService).limits());

  /** The chosen state's code. */
  protected readonly state = signal('');

  /** The county code as the form holds it. */
  private readonly fips = signal('');

  protected readonly states = computed(() =>
    Object.entries(this.limits()?.states ?? {}).map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name)));

  protected readonly counties = computed(() => (this.limits()?.counties ?? []).filter((c) => c.state === this.state()));

  /** The chosen county and its limit, or null. */
  protected readonly chosen = computed(() => this.limits()?.counties.find((c) => c.fips === this.fips()) ?? null);

  constructor() {
    // Follow the form's county, and open on its state (a saved loan, or one restored on returning to the page).
    effect((onCleanup) => {
      const control = this.county();
      this.fips.set(control.value);
      const subscription = control.valueChanges.subscribe((value) => this.fips.set(value));
      onCleanup(() => subscription.unsubscribe());
    });
    effect(() => {
      const found = this.limits()?.counties.find((c) => c.fips === this.fips());
      if (found && !this.state()) this.state.set(found.state);
    });
  }

  /** Chooses a state; a county from another state no longer applies. */
  protected chooseState(code: string): void {
    this.state.set(code);
    if (this.chosen()?.state !== code) this.county().setValue('');
  }
}
