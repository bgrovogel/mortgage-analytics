import { MAX_MONTHS, monthsToSave } from './saving-up';

describe('how long to save for the cash to close', () => {
  it('is none when what is saved already covers it', () => {
    expect(monthsToSave(48_000, 48_000, 500, 4)).toBe(0);
    expect(monthsToSave(48_000, 60_000, 0, 0)).toBe(0);
  });

  it('counts the months it takes at a steady amount, with no interest', () => {
    // $1,000 a month toward $48,000, from nothing: forty-eight deposits.
    expect(monthsToSave(48_000, 0, 1_000, 0)).toBe(48);
    // From $10,000 saved, 38 more.
    expect(monthsToSave(48_000, 10_000, 1_000, 0)).toBe(38);
  });

  it('rounds up to the month the target is first reached', () => {
    expect(monthsToSave(1_001, 0, 1_000, 0)).toBe(2);
  });

  it('is sooner with interest, which is paid monthly on what is saved', () => {
    const plain = monthsToSave(48_000, 10_000, 1_000, 0);
    const earning = monthsToSave(48_000, 10_000, 1_000, 5);

    expect(earning).toBeLessThan(plain ?? Infinity);
    // 5% a year is 5/12 % a month: $10,000 grows by $41.67 in the first month before the deposit.
    expect(monthsToSave(10_010, 10_000, 0, 5)).toBe(1);
  });

  it('is null when nothing is saved each month and interest alone never gets there within fifty years', () => {
    expect(monthsToSave(48_000, 10_000, 0, 0)).toBeNull();
    expect(monthsToSave(48_000_000, 1_000, 10, 4)).toBeNull();
    expect(MAX_MONTHS).toBe(600);
  });

  it('reaches the target on the last allowed month, and not beyond it', () => {
    expect(monthsToSave(600, 0, 1, 0)).toBe(600);
    expect(monthsToSave(601, 0, 1, 0)).toBeNull();
  });
});
