/** The longest the answer looks: fifty years of months, the longest a loan can run. */
export const MAX_MONTHS = 600;

/**
 * How many months it takes to save up `target`: from `saved` already, adding `monthly` at the end of each month, with
 * the balance earning `annualRatePercent` a year, paid monthly. 0 when it is already there, and null when it takes
 * more than fifty years (or never, with nothing added and no interest to get there).
 */
export function monthsToSave(target: number, saved: number, monthly: number, annualRatePercent: number): number | null {
  const growth = 1 + annualRatePercent / 1200;
  let balance = saved;
  for (let month = 0; month <= MAX_MONTHS; month++) {
    if (balance >= target) return month;
    balance = balance * growth + monthly;
  }
  return null;
}
