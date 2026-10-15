/**
 * Hides the digits of every dollar amount in a text and keeps its shape ("$2,105.75" becomes "$•,•••.••"), so a screen
 * shared in a meeting shows that there is an amount, and roughly how big, but not what it is. Percentages, years
 * and dates are not money and stay readable.
 */
export function maskAmounts(text: string): string {
  return text.replace(/\$[\d,]+(?:\.\d+)?/g, (amount) => amount.replace(/\d/g, '•'));
}
