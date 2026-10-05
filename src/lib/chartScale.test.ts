import { describe, expect, it } from 'vitest';
import { compactUsd, niceTicks, yearTicks } from './chartScale';

describe('chart scale', () => {
  it('picks round ticks that cover the values', () => {
    expect(niceTicks(0, 167_420)).toEqual([0, 50_000, 100_000, 150_000, 200_000]);
    expect(niceTicks(0, 1_000)).toEqual([0, 250, 500, 750, 1_000]);
    expect(niceTicks(-40_000, 90_000)).toEqual([-50_000, 0, 50_000, 100_000]);
    expect(niceTicks(0, 0)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(niceTicks(5, 5)).toEqual([4, 6, 8, 10]);
  });

  it('writes amounts in a few characters', () => {
    expect(compactUsd(0)).toBe('$0');
    expect(compactUsd(950)).toBe('$950');
    expect(compactUsd(12_500)).toBe('$12.5k');
    expect(compactUsd(250_000)).toBe('$250k');
    expect(compactUsd(1_200_000)).toBe('$1.2M');
    expect(compactUsd(3e9)).toBe('$3B');
    expect(compactUsd(2.5e12)).toBe('$2.5T');
    expect(compactUsd(-40_000)).toBe('−$40k');
  });

  it('labels at most about six years, always the last', () => {
    expect(yearTicks(1)).toEqual([0, 1]);
    expect(yearTicks(2)).toEqual([0, 1, 2]);
    expect(yearTicks(7)).toEqual([0, 2, 4, 7]);
    expect(yearTicks(12)).toEqual([0, 3, 6, 9, 12]);
    expect(yearTicks(50)).toEqual([0, 10, 20, 30, 40, 50]);
  });
});
