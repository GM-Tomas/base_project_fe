import { describe, expect, it } from 'vitest';
import { AMOUNT_HINT, NEGATIVE_AMOUNT, formatUsd, parseAmount } from './money';

describe('parseAmount', () => {
  it.each([
    ['1234.56', 1234.56],
    ['1,234.56', 1234.56],
    ['1.234,56', 1234.56],
    ['1234,56', 1234.56],
    ['1 234,56', 1234.56],
    ['1 234,56', 1234.56],
    ['$1,234', 1234],
    ['US$ 1.234', 1234],
    ['usd 100', 100],
    ['1.234.567', 1234567],
    ['1,234,567.89', 1234567.89],
    ['1.234.567,89', 1234567.89],
    ['12,5', 12.5],
    ['12.', 12],
    ['.5', 0.5],
    [',5', 0.5],
    ['0', 0],
    ['-0', 0],
    ['007', 7],
    ['0.125', 0.13],
    ['0,500', 0.5],
    ['1234.567', 1234.57],
    ['1.005', 1005],
    ['1,005', 1005],
    ['1.0050', 1.01],
    ['2.675', 2675],
    ['2.6750', 2.68],
    ['999.999,999', 1000000],
  ])('reads %j as %d', (text, value) => {
    expect(parseAmount(text)).toEqual({ value });
  });

  it.each(['', '   ', '$', '.', 'abc', '1e5', '5-', '1.2.3', '12.34,5', '1,23,456.78', '1,234.567.8', '1..2', '0.123.456'])(
    'rejects %j',
    (text) => {
      expect(parseAmount(text)).toEqual({ error: AMOUNT_HINT });
    },
  );

  it.each(['-5', '−5', '-$5', '$-5', '- 1.234,56'])('rejects the negative %j', (text) => {
    expect(parseAmount(text)).toEqual({ error: NEGATIVE_AMOUNT });
  });

  it('rejects numbers too long to be finite', () => {
    expect(parseAmount('9'.repeat(400))).toEqual({ error: AMOUNT_HINT });
  });

  it('keeps every cent of large amounts', () => {
    expect(parseAmount('999.999.999.999,99')).toEqual({ value: 999999999999.99 });
  });
});

describe('formatUsd', () => {
  it('shows cents and thousands separators', () => {
    expect(formatUsd(1234.5)).toBe('$1,234.50');
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUsd(-12)).toBe('-$12.00');
  });
});
