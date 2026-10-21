import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, input } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { switchMap } from 'rxjs';
import { NumberFieldComponent } from '../../core/forms/number-field.component';
import { ARM_TYPES, ArmMode, BUYDOWNS, RATE_OPTION_RULES, RateOptionsForm, buydownSteps } from './rate-options';
import { TPipe } from '../../core/i18n/t.pipe';
import { msg } from '../../core/i18n/i18n';

/**
 * How a loan's rate works, wherever a loan has one: fixed, a temporary buydown, or adjustable (an ARM, by its type
 * for a new loan or by the payments until its next reset for one already being paid). The parent owns the form
 * group (see rateOptionsForm); this only shows it.
 */
@Component({
  selector: 'app-rate-options',
  imports: [ReactiveFormsModule, NumberFieldComponent, TPipe],
  templateUrl: './rate-options.component.html',
  styleUrl: './rate-options.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RateOptionsComponent {
  /** The options' controls. */
  readonly form = input.required<RateOptionsForm>();

  /** How an adjustable rate's fixed period is given. */
  readonly mode = input<ArmMode>('type');

  /** True to offer a temporary buydown. */
  readonly allowBuydown = input(true);

  /**
   * The loan's (note or starting) rate, for the buydown's yearly rates. An emptied rate box holds null
   * (NumberInputDirective), which reads as 0% until a rate is typed.
   */
  readonly rate = input(0, { transform: (value: number | null) => value ?? 0 });

  /** What the fixed period counts from, in 'reset' mode: "Next reset in (payments)" by default. */
  readonly resetLabel = input(msg('Next reset in (payments)'));

  /** Put before each test id, so two loans on one page stay apart: 'new-' gives 'new-rate-type-arm'. */
  readonly idPrefix = input('');

  protected readonly buydowns = BUYDOWNS;
  protected readonly armTypes = ARM_TYPES;
  protected readonly rules = RATE_OPTION_RULES;

  /** Re-read whenever the options change, so the template follows. */
  private readonly changes = inject(ChangeDetectorRef);

  constructor() {
    toObservable(this.form)
      .pipe(switchMap((form) => form.valueChanges), takeUntilDestroyed())
      .subscribe(() => this.changes.markForCheck());
  }

  /** "4.5% in year 1, 5.5% in year 2, then 6.5%", for the current plan and rate. */
  protected buydownStepsNow(): string {
    return buydownSteps(this.form().controls.buydownPlan.value, this.rate());
  }
}
