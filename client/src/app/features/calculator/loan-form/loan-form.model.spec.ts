import { FormBuilder } from '@angular/forms';
import { firstOfMonthFromNext } from '../../../core/loans/loan-progress';
import { AmortizationRequest } from '../../../core/models/amortization.models';
import {
  FHA_DOWN_TOO_LOW, FHA_LOW_SCORE_DOWN_TOO_LOW, FHA_SCORE_TOO_LOW, chargedTaxes, fhaDownProblem, loanForm, lumpSumGroup, pointsApply,
  rateChangeGroup, rateChangesOf, restoreLoanForm, syncPoints, syncTaxMode, toLoanRequest,
} from './loan-form.model';

/**
 * The form's data on its own, without the component: its defaults and rules, the request it makes, and the request
 * it restores. The component's spec covers what the page does with them.
 */
describe('loan form model', () => {
  const fb = new FormBuilder().nonNullable;
  const newForm = () => loanForm(fb);

  describe('defaults', () => {
    it('start every optional field blank or at zero, and the choices at their usual answer', () => {
      const v = newForm().getRawValue();

      expect(v).toEqual(expect.objectContaining({
        loanProgram: 'Conventional', vaUse: 'FirstUse', financeUpfrontFee: true, creditScore: null, countyFips: '',
        firstPaymentDate: firstOfMonthFromNext(0),
        localHomesteadExemptionPercent: 0, mudHomesteadExemptionPercent: 0, homesteadAssessmentCap: 10,
        isOver65: false, over65Year: 1, over65LocalExemption: 0, transferredCeilingPercent: null,
        pidAnnual: 0, pidYears: null, pmiCancellation: 'BorrowerRequested', closingCredits: 0,
        annualExtra: 0, annualFirstPayment: 12, usePoints: false, rateWithoutPoints: 6.75, buydownPaidBy: 'Seller',
      }));
    });

    it.each([
      ['creditScore', 299],
      ['transferredCeilingPercent', 0],
      ['pidYears', 0],
      ['localHomesteadExemptionPercent', 101],
      ['mudHomesteadExemptionPercent', 101],
      ['homesteadAssessmentCap', 101],
      ['over65Year', 0],
      ['over65LocalExemption', -1],
      ['pidAnnual', -1],
      ['closingCredits', -1],
      ['annualExtra', -1],
      ['annualFirstPayment', 0],
      ['rateWithoutPoints', -1],
    ] as const)('check %s against its rule', (name, outOfRange) => {
      const form = newForm();
      const control = form.controls[name];
      control.enable();
      control.setValue(outOfRange as never);

      expect(control.valid).toBe(false);
    });
  });

  describe('a tax rate change row', () => {
    it('starts with every rate blank, so it keeps them all', () => {
      expect(rateChangeGroup(fb, 3).getRawValue()).toEqual({ fromYear: 3, propertyTaxRate: null, schoolTaxRate: null, localTaxRate: null, mudTaxRate: null });
    });

    it('holds the rates it is given, each checked against its rule', () => {
      const row = rateChangeGroup(fb, 4, { schoolTaxRate: 0.9, localTaxRate: 1.2, mudTaxRate: 0.7 });

      expect(row.getRawValue()).toEqual({ fromYear: 4, propertyTaxRate: null, schoolTaxRate: 0.9, localTaxRate: 1.2, mudTaxRate: 0.7 });
      for (const name of ['schoolTaxRate', 'localTaxRate', 'mudTaxRate'] as const) {
        row.controls[name].setValue(11);
        expect(row.controls[name].valid).toBe(false);
      }
    });
  });

  describe('which taxes are charged, and so can change', () => {
    it('is the one combined rate while it is above zero', () => {
      const form = newForm();
      expect(chargedTaxes(form.getRawValue())).toEqual(['propertyTaxRate']);

      form.controls.propertyTaxRate.setValue(0);
      expect(chargedTaxes(form.getRawValue())).toEqual([]);
    });

    it('sends only the charged taxes of each change, and drops a change of none of them', () => {
      const form = newForm();
      form.patchValue({ taxMode: 'separate', schoolTaxRate: 0, localTaxRate: 1.1, mudTaxRate: 0.85 });
      form.controls.rateChanges.push(rateChangeGroup(fb, 2, { localTaxRate: 1.3 }));
      form.controls.rateChanges.push(rateChangeGroup(fb, 3, { mudTaxRate: 0.9 }));
      form.controls.rateChanges.push(rateChangeGroup(fb, 4, { schoolTaxRate: 1.2, propertyTaxRate: 2 }));

      expect(rateChangesOf(form.getRawValue())).toEqual([
        { fromYear: 2, propertyTaxRate: null, schoolTaxRate: null, localTaxRate: 1.3, mudTaxRate: null },
        { fromYear: 3, propertyTaxRate: null, schoolTaxRate: null, localTaxRate: null, mudTaxRate: 0.9 },
      ]);
    });

    it('is none at all when there are no changes', () => {
      expect(rateChangesOf({ taxMode: 'single', propertyTaxRate: 2 })).toEqual([]);
    });
  });

  describe("FHA's down payment, by credit score", () => {
    it.each([
      [499, 50_000, FHA_SCORE_TOO_LOW],
      [500, 50_000, null],
      [579, 50_000, null],
      [579, 49_999, FHA_LOW_SCORE_DOWN_TOO_LOW],
      [580, 17_500, null],
      [580, 17_499, FHA_DOWN_TOO_LOW],
      [null, 17_500, null],
      [undefined, 17_499, FHA_DOWN_TOO_LOW],
    ])('a score of %s with $%s down on $500,000 → %s', (score, down, problem) => {
      expect(fhaDownProblem(down, 500_000, score)).toBe(problem);
    });
  });

  describe('discount points', () => {
    it('apply when chosen, unless the rate is adjustable, and on a form with no rate type at all', () => {
      expect(pointsApply({ usePoints: true })).toBe(true);
      expect(pointsApply({ usePoints: true, rate: { rateType: 'arm' } })).toBe(false);
      expect(pointsApply({ usePoints: false })).toBe(false);
    });

    it('turn their fields on and off quietly, so no request is sent for it', () => {
      const form = newForm();
      const changes = jest.fn();
      form.valueChanges.subscribe(changes);

      form.controls.usePoints.setValue(true, { emitEvent: false });
      syncPoints(form);
      const onWhenChosen = form.controls.points.enabled && form.controls.rateWithoutPoints.enabled;
      form.controls.usePoints.setValue(false, { emitEvent: false });
      syncPoints(form);

      expect(onWhenChosen).toBe(true);
      expect(form.controls.points.disabled && form.controls.rateWithoutPoints.disabled).toBe(true);
      expect(changes).not.toHaveBeenCalled();
    });

    it('start the rate without points a quarter above an equal rate, but never move one already typed, or while off', () => {
      const equal = newForm();
      equal.patchValue({ usePoints: true, annualInterestRate: 6.5, rateWithoutPoints: 6.5 });
      syncPoints(equal);

      const typed = newForm();
      typed.patchValue({ usePoints: true, annualInterestRate: 6.5, rateWithoutPoints: 6 });
      typed.controls.rateWithoutPoints.markAsDirty();
      syncPoints(typed);

      const off = newForm();
      off.patchValue({ usePoints: false, annualInterestRate: 6.5, rateWithoutPoints: 6 });
      syncPoints(off);

      const higher = newForm();
      higher.patchValue({ usePoints: true, annualInterestRate: 6.5, rateWithoutPoints: 7 });
      syncPoints(higher);

      expect(equal.controls.rateWithoutPoints.value).toBe(6.75);
      expect(higher.controls.rateWithoutPoints.value).toBe(7);
      expect(typed.controls.rateWithoutPoints.value).toBe(6);
      expect(off.controls.rateWithoutPoints.value).toBe(6);
    });
  });

  it('switches the tax fields quietly', () => {
    const form = newForm();
    const changes = jest.fn();
    form.valueChanges.subscribe(changes);

    form.controls.taxMode.setValue('separate', { emitEvent: false });
    syncTaxMode(form);

    expect(form.controls.schoolTaxRate.enabled && form.controls.propertyTaxRate.disabled).toBe(true);
    expect(changes).not.toHaveBeenCalled();
  });

  describe('the request', () => {
    it('moves a yearly extra already past to its next year, and keeps one still ahead', () => {
      const form = newForm();
      form.patchValue({ annualExtra: 1_000, annualFirstPayment: 6 });
      const past = toLoanRequest(form, 20).extraPayments!.annual;
      form.patchValue({ annualFirstPayment: 24 });
      const ahead = toLoanRequest(form, 20).extraPayments!.annual;

      expect(past).toEqual({ amount: 1_000, firstPaymentNumber: 30 });
      expect(ahead).toEqual({ amount: 1_000, firstPaymentNumber: 24 });
    });

    it('sends what was typed in each optional field, and zero for a blank one', () => {
      const fields = {
        localHomesteadExemptionPercent: 'localHomesteadExemptionPercent', mudHomesteadExemptionPercent: 'mudHomesteadExemptionPercent',
        homesteadAssessmentCap: 'homesteadAssessmentCap', homeValueGrowthRate: 'homeValueGrowthRate',
        insuranceIncreaseRate: 'insuranceIncreaseRate', hoaIncreaseRate: 'hoaIncreaseRate', annualInsurance: 'annualHomeownersInsurance',
      } as const;
      const typed = newForm();
      const blank = newForm();
      for (const [name, sent] of Object.entries(fields) as [keyof typeof fields, string][]) {
        typed.controls[name].setValue(7);
        blank.controls[name].setValue(null as never);
        expect((toLoanRequest(typed, 1).housingCosts as unknown as Record<string, unknown>)[sent]).toBe(7);
        expect((toLoanRequest(blank, 1).housingCosts as unknown as Record<string, unknown>)[sent]).toBe(0);
      }
    });

    it("sends FHA's credit score and county only for an FHA loan", () => {
      const form = newForm();
      form.patchValue({ loanProgram: 'Va', creditScore: 640, countyFips: '48491' });

      expect(toLoanRequest(form, 1).program).toEqual(expect.objectContaining({ type: 'Va', creditScore: null, countyFips: null }));
    });
  });

  describe('restoring a request', () => {
    /** A form with every field away from its default, so a value lost on the way back shows. */
    function unusualForm() {
      const form = newForm();
      form.patchValue({
        homePrice: 410_000, downPayment: 41_000, annualInterestRate: 6.125, termYears: 25, firstPaymentDate: '2027-03-01',
        taxMode: 'separate', schoolTaxRate: 1.1, localTaxRate: 0.6, mudTaxRate: 0.9, isHomestead: true, schoolHomesteadExemption: 100_000,
        localHomesteadExemptionPercent: 20, mudHomesteadExemptionPercent: 15, homesteadAssessmentCap: 8,
        isOver65: true, over65Year: 3, over65SchoolExemption: 10_000, over65LocalExemption: 5_000, over65LocalCeiling: true,
        transferredCeilingPercent: 62.5, homeValueGrowthRate: 3, insuranceIncreaseRate: 5, hoaIncreaseRate: 2,
        pidAnnual: 900, pidYears: 12, annualInsurance: 2_000, monthlyHoa: 75, pmiCancellation: 'BorrowerRequested',
        loanCosts: 3_000, otherFees: 700, prepaidInterestDays: 10, escrowMonths: 2, closingCredits: 500,
        monthlyExtra: 150, annualExtra: 1_200, annualFirstPayment: 6, buydownPaidBy: 'Borrower',
        loanProgram: 'Fha', financeUpfrontFee: false, creditScore: 600, countyFips: '48491',
        usePoints: true, points: 1.5, rateWithoutPoints: 6.5,
      });
      form.controls.lumpSums.push(lumpSumGroup(fb, 24, 5_000));
      form.controls.rateChanges.push(rateChangeGroup(fb, 5, { schoolTaxRate: 1 }));
      syncTaxMode(form);
      syncPoints(form);
      return form;
    }

    it('gives back the very request it was given, with every unusual value', () => {
      const request = toLoanRequest(unusualForm(), 1);
      const form = newForm();

      restoreLoanForm(form, fb, request);

      expect(toLoanRequest(form, 1)).toEqual(request);
    });

    it('replaces the lump sums and rate changes, rather than adding to them', () => {
      const request = toLoanRequest(unusualForm(), 1);
      const form = newForm();

      restoreLoanForm(form, fb, request);
      restoreLoanForm(form, fb, request);

      expect(form.controls.lumpSums.length).toBe(1);
      expect(form.controls.rateChanges.length).toBe(1);
    });

    it('turns on the fields of what it restores: the separate taxes and the points', () => {
      const form = newForm();

      restoreLoanForm(form, fb, toLoanRequest(unusualForm(), 1));

      expect(form.controls.schoolTaxRate.enabled && form.controls.propertyTaxRate.disabled).toBe(true);
      expect(form.controls.points.enabled).toBe(true);
    });

    it.each([
      [2, 1, 1, 2, 'single'],
      [0, 1, 1, 2, 'separate'],
      [0, 1, 2, 1, 'separate'],
      [0, 0, 0, 0, 'single'],
    ])('a combined rate of %s with school %s, local %s and MUD %s is entered as %s', (property, school, local, mud, mode) => {
      const request = toLoanRequest(newForm(), 1);
      const form = newForm();

      restoreLoanForm(form, fb, { ...request, housingCosts: { ...request.housingCosts!, propertyTaxRate: property, schoolTaxRate: school, localTaxRate: local, mudTaxRate: mud } });

      expect(form.controls.taxMode.value).toBe(mode);
    });

    it('fills what an older or plainer request leaves out: no homestead, the seller paying, no FHA county', () => {
      const form = unusualForm();
      const plain: AmortizationRequest = { ...toLoanRequest(newForm(), 1), housingCosts: null, buydownPaidBy: undefined, program: null };

      restoreLoanForm(form, fb, plain);

      expect(form.controls.isHomestead.value).toBe(false);
      expect(form.controls.buydownPaidBy.value).toBe('Seller');
      expect(form.controls.countyFips.value).toBe('');
    });
  });
});
