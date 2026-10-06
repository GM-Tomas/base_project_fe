import { afterEach, describe, expect, it, vi } from 'vitest';
import { amountsHidden, setAmountsHidden } from './privacy';
import { formatCurrency, formatSignedCurrency } from './calculations';
import { compactUsd } from './chartScale';
import { exactUsd, formatUsd } from './money';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('privacy mode', () => {
  it('hides what the formatters show, but not exact amounts for fields', () => {
    setAmountsHidden(true);
    expect(amountsHidden()).toBe(true);
    expect([formatCurrency(1234), formatSignedCurrency(-5), formatUsd(1234.5), compactUsd(250_000)]).toEqual([
      '$•••••',
      '$•••••',
      '$•••••',
      '$•••',
    ]);
    expect(exactUsd(1234.5)).toBe('$1,234.50');
    setAmountsHidden(false);
    expect(formatCurrency(1234)).toBe('$1,234');
  });

  it('is kept for this visit when the browser keeps nothing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    setAmountsHidden(true);
    expect(amountsHidden()).toBe(true);
  });
});
