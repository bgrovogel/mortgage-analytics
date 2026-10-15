import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { AmortizationRequest } from '../../core/models/amortization.models';
import { MAX_HOMES, homeName } from '../../core/models/home-comparison.models';
import { CalculationPageComponent } from '../../shared/calculation-page/calculation-page.component';
import { BuyTabsComponent } from '../calculator/buy-tabs/buy-tabs.component';
import { CalculatorStore } from '../calculator/calculator.store';
import { LoanFormComponent } from '../calculator/loan-form/loan-form.component';
import { CompareResultsComponent } from './compare-results.component';
import { ComparisonStore } from './comparison.store';

/**
 * Compare homes: two to four side by side. Home A is the calculator's own loan, so it follows the calculator (and the
 * other pages) and changes them in turn; the others are full loans of their own. One form at a time edits any of
 * them, chosen by the switch above it, so element ids stay unique; Add a home copies Home A, and Remove takes out the
 * home being edited, never Home A, down to two.
 */
@Component({
  selector: 'app-compare-page',
  imports: [BuyTabsComponent, CalculationPageComponent, LoanFormComponent, CompareResultsComponent],
  template: `
    <app-calculation-page [store]="comparison" heading="Which home costs less?" label="Homes compared"
                          intro="Up to four homes side by side, each any loan: what each costs a month, to close, and over the first years."
                          [problems]="problems()" placeholder="Comparing your homes…" errorTitle="We couldn't compare those homes.">
      <app-buy-tabs tabs />
      <div form>
        <div class="segmented house-switch" role="radiogroup" aria-label="Which home to edit" data-testid="house-switch">
          @for (home of homeIndexes(); track home) {
            <label>
              <input type="radio" name="house" [value]="home" [checked]="editing() === home" (change)="edit(home)" [attr.data-testid]="'edit-home-' + letterOf(home)" />
              {{ nameOf(home) }}
            </label>
          }
        </div>
        <div class="house-actions">
          @if (homeIndexes().length < maxHomes) {
            <button type="button" class="link-button" (click)="addHome()" data-testid="add-home">+ Add a home</button>
          }
          @if (editing() > 0 && homeIndexes().length > 2) {
            <button type="button" class="link-button" (click)="removeHome()" data-testid="remove-home">Remove {{ nameOf(editing()) }}</button>
          }
        </div>
        @if (editing() === 0) {
          <app-loan-form heading="Home A" [initial]="startFrom()" [loan]="loan()" [firstYear]="calculator.result()?.projection?.[0] ?? null"
                         (calculate)="calculator.send($event)" (problems)="problems.set($event)" />
        } @else {
          <!-- Tracked by the home, so each home gets a form of its own. -->
          @for (home of [editing()]; track home) {
            <app-loan-form [heading]="nameOf(home)" [shared]="false" [initial]="comparison.request()?.homes?.[home] ?? calculator.request()"
                           [firstYear]="comparison.result()?.homes?.[home]?.projection?.[0] ?? null" (calculate)="sendOther(home, $event)" (problems)="problems.set($event)" />
          }
        }
      </div>
      @if (comparison.result()) {
        <app-compare-results />
      }
    </app-calculation-page>
  `,
  styleUrl: './compare-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComparePageComponent {
  protected readonly calculator = inject(CalculatorStore);
  protected readonly comparison = inject(ComparisonStore);

  protected readonly maxHomes = MAX_HOMES;
  protected readonly nameOf = homeName;

  /** Each home's place in the comparison: two until the comparison says otherwise. */
  protected readonly homeIndexes = computed(() => [...Array(this.comparison.request()?.homes.length ?? 2).keys()]);

  /** Which home the switch has chosen to edit, by its place: 0 is Home A. */
  protected readonly house = signal(0);
  protected readonly editing = computed(() => Math.min(this.house(), this.homeIndexes().length - 1));

  /**
   * Where Home A's form starts: the calculator's loan when the page opens, then (after switching to another home and
   * back) what it was showing. Read once by each new form, which owns its values from then on.
   */
  protected readonly startFrom = signal(this.calculator.request());

  /** The loan another page changed since the calculator last sent one: for Home A's first form only, which applies it. */
  protected readonly loan = signal(this.calculator.loanToApply());

  /** What is wrong with the form, if anything; while it is not empty the results are for the last valid inputs. */
  protected readonly problems = signal<string[]>([]);

  constructor() {
    // Home A is the calculator's loan: whenever that changes (or the page opens), compare again. A new comparison's
    // Home B starts as a copy of Home A, to change whatever differs.
    effect(() => {
      const first = this.calculator.request();
      const current = untracked(this.comparison.request);
      if (first && current?.homes[0] !== first) this.comparison.send({ homes: [first, ...(current?.homes.slice(1) ?? [first])] });
    });
  }

  /** "a", "b"...: a home's letter, for its test id. */
  protected letterOf(home: number): string {
    return homeName(home).slice(-1).toLowerCase();
  }

  /** Switches the form between the homes. Each form is made anew from its store, so the page has one form. */
  protected edit(house: number): void {
    if (house === this.house()) return;
    this.startFrom.set(this.calculator.request());
    this.loan.set(null);
    this.problems.set([]);
    this.house.set(house);
  }

  /** Another home changed: compare it with the rest. */
  protected sendOther(home: number, request: AmortizationRequest): void {
    const current = this.comparison.request();
    if (current) this.comparison.send({ homes: current.homes.map((h, i) => (i === home ? request : h)) });
  }

  /** Adds a home, a copy of Home A to change whatever differs, and edits it. */
  protected addHome(): void {
    const current = this.comparison.request();
    if (!current || current.homes.length >= MAX_HOMES) return;
    this.comparison.send({ homes: [...current.homes, current.homes[0]] });
    this.edit(current.homes.length);
  }

  /** Removes the home being edited, and edits the one before it. */
  protected removeHome(): void {
    const current = this.comparison.request();
    const home = this.editing();
    if (!current || home === 0 || current.homes.length <= 2) return;
    this.comparison.send({ homes: current.homes.filter((_, i) => i !== home) });
    this.edit(home - 1);
  }
}
