import { maskAmounts } from './mask-amounts';

describe('maskAmounts', () => {
  it('keeps the shape of every dollar amount and hides its digits', () => {
    expect(maskAmounts('$2,105.75 a month, principal and interest')).toBe('$•,•••.•• a month, principal and interest');
  });

  it('masks each amount in a line, and leaves the rest of it readable', () => {
    expect(maskAmounts('$380,000 home · 10% down · 6.25% · 30 yr · $200/mo extra'))
      .toBe('$•••,••• home · 10% down · 6.25% · 30 yr · $•••/mo extra');
  });

  it('leaves a text without money alone', () => {
    expect(maskAmounts('Oak St, saved Oct 15, 2026')).toBe('Oak St, saved Oct 15, 2026');
  });
});
