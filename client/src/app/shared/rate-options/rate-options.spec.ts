import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { applySharedRate, keepArmFieldsInStep, rateOptionsForm, rateOptionsRequest, rateSummary, setRateOptions } from './rate-options';

/** The rate options as data: fixed, a buydown or an ARM, to and from a request and the shared loan. */
describe('rate options', () => {
  const fb = new FormBuilder().nonNullable;
  const arm = { initialFixedMonths: 84, adjustmentIntervalMonths: 12, expectedRate: 7.5, initialCap: 5, periodicCap: 2, lifetimeCap: 5, margin: 2.75 };

  it("start fixed, with the ARM's numbers off, so they are neither checked nor sent", () => {
    const form = rateOptionsForm(fb);

    expect(form.controls.rateType.value).toBe('fixed');
    expect(form.controls.armExpectedRate.disabled && form.controls.armFixedMonths.disabled && form.controls.armMargin.disabled).toBe(true);
    expect(rateOptionsRequest(form, 'type')).toEqual({ buydown: null, adjustableRate: null });
  });

  it("turn the ARM's numbers on while the rate is adjustable, from the start and on every change", () => {
    const form = rateOptionsForm(fb);
    form.controls.rateType.setValue('arm', { emitEvent: false });
    keepArmFieldsInStep(form, TestBed.inject(DestroyRef));
    const onAtStart = form.controls.armExpectedRate.enabled;
    form.controls.rateType.setValue('fixed');

    expect(onAtStart).toBe(true);
    expect(form.controls.armExpectedRate.disabled).toBe(true);
  });

  it("take an ARM's fixed period from its type for a new loan, and from the payments until its reset otherwise", () => {
    const form = rateOptionsForm(fb);
    form.patchValue({ rateType: 'arm', armType: '7/1', armFixedMonths: 30 });

    expect(rateOptionsRequest(form, 'type').adjustableRate?.initialFixedMonths).toBe(84);
    expect(rateOptionsRequest(form, 'reset').adjustableRate?.initialFixedMonths).toBe(30);
  });

  describe('set from a request', () => {
    it('quietly, so the form sends nothing for it', () => {
      const form = rateOptionsForm(fb);
      const changes = jest.fn();
      form.valueChanges.subscribe(changes);

      setRateOptions(form, { yearlyReductions: [3, 2, 1] }, null);
      setRateOptions(form, null, arm);
      setRateOptions(form, null, null);

      expect(changes).not.toHaveBeenCalled();
    });

    it('as the usual buydown it is, or a 2-1 for one that is not usual', () => {
      const form = rateOptionsForm(fb);
      setRateOptions(form, { yearlyReductions: [3, 2, 1] }, null);
      const usual = form.controls.buydownPlan.value;
      setRateOptions(form, { yearlyReductions: [4] }, null);

      expect(usual).toBe('3-2-1');
      expect(form.getRawValue()).toEqual(expect.objectContaining({ rateType: 'buydown', buydownPlan: '2-1' }));
    });

    it('as its ARM type, with every number, and the numbers turned on', () => {
      const form = rateOptionsForm(fb);
      setRateOptions(form, null, { ...arm, initialFixedMonths: 60, adjustmentIntervalMonths: 6, margin: undefined });

      expect(form.getRawValue()).toEqual(expect.objectContaining({
        rateType: 'arm', armType: '5/6', armFixedMonths: 60, armIntervalMonths: 6, armExpectedRate: 7.5,
        armInitialCap: 5, armPeriodicCap: 2, armLifetimeCap: 5, armMargin: null,
      }));
      expect(form.controls.armExpectedRate.enabled).toBe(true);
    });

    it('as "other" for an ARM of no usual type, and back to fixed with its numbers off', () => {
      const form = rateOptionsForm(fb);
      setRateOptions(form, null, { ...arm, adjustmentIntervalMonths: 3 });
      const type = form.controls.armType.value;
      setRateOptions(form, null, null);

      expect(type).toBe('other');
      expect(form.controls.rateType.value).toBe('fixed');
      expect(form.controls.armExpectedRate.disabled).toBe(true);
    });
  });

  describe('the shared rate', () => {
    it('changes nothing when there is none, and says so', () => {
      const form = rateOptionsForm(fb);

      expect(applySharedRate(form, null)).toBe(false);
      expect(applySharedRate(form, { kind: 'fixed' })).toBe(false);
    });

    it('takes an ARM counted from today, as counted from the first payment here', () => {
      const form = rateOptionsForm(fb);
      const changed = applySharedRate(form, {
        kind: 'arm', nextResetIn: 24, intervalMonths: 12, expectedRate: 8, initialCap: 2, periodicCap: 1, lifetimeCap: 6, margin: 3,
      }, 60);

      expect(changed).toBe(true);
      expect(form.getRawValue()).toEqual(expect.objectContaining({
        rateType: 'arm', armType: '7/1', armFixedMonths: 84, armExpectedRate: 8, armInitialCap: 2, armPeriodicCap: 1, armLifetimeCap: 6, armMargin: 3,
      }));
    });

    it('takes an ARM without a margin as having none', () => {
      const form = rateOptionsForm(fb);
      applySharedRate(form, { kind: 'arm', nextResetIn: 60, intervalMonths: 12, expectedRate: 8, initialCap: 2, periodicCap: 1, lifetimeCap: 6, margin: null });

      expect(form.controls.armMargin.value).toBeNull();
    });

    it('takes a buydown as fixed on a page that cannot hold one', () => {
      const form = rateOptionsForm(fb);
      form.patchValue({ rateType: 'arm' });

      expect(applySharedRate(form, { kind: 'buydown', yearlyReductions: [2, 1] }, 0, false)).toBe(true);
      expect(form.controls.rateType.value).toBe('fixed');
    });
  });

  describe('the summary', () => {
    const summaryOf = (patch: Parameters<ReturnType<typeof rateOptionsForm>['patchValue']>[0], mode: 'type' | 'reset' = 'type') => {
      const form = rateOptionsForm(fb);
      form.patchValue(patch);
      return rateSummary(form, mode, 6.5);
    };

    it('names an ARM by its type, its payments left, or its payments, with its caps and floor', () => {
      expect(summaryOf({ rateType: 'arm', armType: '7/1' })).toBe('7/1 ARM: 6.5% for 7 yr, then toward 7.5% (caps 5/2/5, floor 2.75%)');
      expect(summaryOf({ rateType: 'arm', armFixedMonths: 30 }, 'reset')).toBe('Adjustable: 6.5% for 30 more payments, then toward 7.5% (caps 5/2/5, floor 2.75%)');
      expect(summaryOf({ rateType: 'arm', armType: 'other', armFixedMonths: 36, armMargin: null })).toBe('ARM: 6.5% for 36 payments, then toward 7.5% (caps 5/2/5)');
    });

    it('says a fixed rate is fixed', () => {
      expect(summaryOf({})).toBe('Fixed for the whole loan');
    });
  });
});
