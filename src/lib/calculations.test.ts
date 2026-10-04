import { describe, expect, it } from 'vitest';
import { formatCurrency, formatPercentage, generateLinePath } from './calculations';

describe('formatCurrency', () => {
  it('rounds to whole dollars with thousands separators', () => {
    expect(formatCurrency(12345.6)).toBe('$12,346');
    expect(formatCurrency(0)).toBe('$0');
  });
});

describe('formatPercentage', () => {
  it('signs positives only', () => {
    expect(formatPercentage(12.34)).toBe('+12.3%');
    expect(formatPercentage(-5)).toBe('-5.0%');
    expect(formatPercentage(0)).toBe('0.0%');
  });
});

describe('generateLinePath', () => {
  it('is empty for no values', () => {
    expect(generateLinePath([], 100, 50, 10)).toEqual({ pathString: '', points: [] });
  });

  it('draws a flat midline for a single value', () => {
    expect(generateLinePath([5], 100, 50, 10)).toEqual({
      pathString: 'M 10,25 L 90,25',
      points: [
        [10, 25],
        [90, 25],
      ],
    });
  });

  it('maps min to the bottom and max to the top', () => {
    const { pathString, points } = generateLinePath([0, 10, 5], 100, 50, 10);
    expect(points).toEqual([
      [10, 40],
      [50, 10],
      [90, 25],
    ]);
    expect(pathString).toBe('M 10.0,40.0 L 50.0,10.0 L 90.0,25.0');
  });

  it('does not divide by zero when all values are equal', () => {
    const { points } = generateLinePath([3, 3], 100, 50, 10);
    expect(points).toEqual([
      [10, 40],
      [90, 40],
    ]);
  });
});
