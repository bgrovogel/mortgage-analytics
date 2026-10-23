import { chooseLanguage } from '../i18n/i18n';
import { compactUsd, decimal, money, monthOf, pct, signedPct, signedUsd, usd, usdCents } from './format';

describe('format', () => {
  it('writes money in whole dollars, in cents, or in cents only when there are any', () => {
    expect(usd(1234.56)).toBe('$1,235');
    expect(usdCents(1234.5)).toBe('$1,234.50');
    expect(money(1500)).toBe('$1,500');
    expect(money(1798.65)).toBe('$1,798.65');
    expect(money(1562.5)).toBe('$1,562.50'); // cents always two digits
    expect(compactUsd(1_250_000)).toBe('$1.3M');
    expect(compactUsd(90_000)).toBe('$90K'); // never "$90.0K", whichever ICU data the runtime ships
    expect(compactUsd(-20_000)).toBe('-$20K');
    expect(compactUsd(0)).toBe('$0'); // never "$0.0"
  });

  it('signs a difference, and calls a rounding-sized one $0', () => {
    expect(signedUsd(1234)).toBe('+$1,234');
    expect(signedUsd(-1234)).toBe('−$1,234');
    expect(signedUsd(0.4)).toBe('$0');
  });

  it('writes numbers and rates with as few decimals as they need', () => {
    expect(decimal(375000)).toBe('375,000');
    expect(decimal(6.125)).toBe('6.13');
    expect(decimal(0.8512, 4)).toBe('0.8512');
    expect(pct(6.5)).toBe('6.5%');
    expect(signedPct(4)).toBe('+4%');
    expect(signedPct(-2)).toBe('-2%');
    expect(signedPct(0)).toBe('0%');
  });

  it('writes a date as its month, whatever the local time zone', () => {
    expect(monthOf('2033-09-01')).toBe('Sep 2033');
  });
});

describe('compactUsd in Spanish', () => {
  afterEach(() => chooseLanguage('en'));

  it('writes thousands as "mil" and millions as "M", the way a Spanish reader expects on a chart axis', async () => {
    await chooseLanguage('es');

    expect([compactUsd(134_600), compactUsd(90_000), compactUsd(1_250_000), compactUsd(-20_000), compactUsd(0)])
      .toEqual(['$134.6 mil', '$90 mil', '$1.3 M', '-$20 mil', '$0']);
  });
});

describe('signedUsd at the edges', () => {
  it('rounds to whole dollars, signed either way, and calls less than half a dollar $0', () => {
    expect([signedUsd(0.6), signedUsd(-0.6), signedUsd(0.4), signedUsd(-0.4)]).toEqual(['+$1', '−$1', '$0', '$0']);
  });
});
