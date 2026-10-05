import { describe, expect, it } from 'vitest';
import { expectedReturnOf, formatReturn, parsePercent, returnShares, round2, validReturn } from './returns';

const h = (name: string, assetClass: string, valueUsd: number, effectiveReturnPct: number | null) => ({
  name,
  assetClass,
  valueUsd,
  effectiveReturnPct,
});

describe('expected returns', () => {
  it('rounds and checks like the API', () => {
    expect(round2(7.455)).toBe(7.46);
    expect(round2(-7.455)).toBe(-7.46);
    expect(round2(1.005)).toBe(1.01); // as written, not as stored in binary
    expect(round2(1e-7)).toBe(0);
    expect(round2(-0.001)).toBe(0);
    expect(round2(1e21)).toBe(1e21);
    expect(validReturn(100.004)).toBe(true);
    expect(validReturn(100.005)).toBe(false);
    expect(validReturn(-100)).toBe(true);
    expect(validReturn(Number.NaN)).toBe(false);
  });

  it('weighs the portfolio by value, with those without a return at 0%', () => {
    expect(expectedReturnOf([h('ETF', 'Index', 60_000, 8), h('Bond', 'Fixed', 30_000, 4.5), h('Cash', 'Cash', 10_000, null)])).toEqual({
      weightedPct: 6.15,
      coveragePct: 90,
      annualUsd: 6_150,
    });
    expect(expectedReturnOf([h('a', 'x', 3, 1), h('b', 'x', 6, null)])).toEqual({ weightedPct: 0.33, coveragePct: 33.3, annualUsd: 0.03 });
    expect(expectedReturnOf([])).toEqual({ weightedPct: null, coveragePct: 0, annualUsd: 0 });
    expect(expectedReturnOf([h('a', 'x', 0, 9)]).weightedPct).toBeNull();
  });

  it("says what each class and each holding adds to it, largest first", () => {
    const { byClass, byAsset } = returnShares([
      h('ETF', 'Index', 60_000, 8),
      h('BTC', 'Crypto', 10_000, -20),
      h('ETH', 'Crypto', 10_000, 30),
      h('Cash', 'Cash', 20_000, null),
    ]);
    expect(byAsset.map((s) => [s.name, s.points])).toEqual([
      ['ETF', 4.8],
      ['ETH', 3],
      ['Cash', 0],
      ['BTC', -2],
    ]);
    expect(byClass).toEqual([
      { name: 'Index', valueUsd: 60_000, points: 4.8, returnPct: 8 },
      { name: 'Crypto', valueUsd: 20_000, points: 1, returnPct: 5 },
      { name: 'Cash', valueUsd: 20_000, points: 0, returnPct: null },
    ]);
    expect(returnShares([h('a', 'x', 0, 5)]).byAsset[0].points).toBe(0);
  });

  it('reads percentages typed either way', () => {
    expect(parsePercent('7.5')).toEqual({ value: 7.5 });
    expect(parsePercent(' 7,5 % ')).toEqual({ value: 7.5 });
    expect(parsePercent('−3')).toEqual({ value: -3 });
    expect(parsePercent('-.5')).toEqual({ value: -0.5 });
    expect(parsePercent('12.')).toEqual({ value: 12 });
    expect(parsePercent('3.14159')).toEqual({ value: 3.14 });
    expect(parsePercent('-0')).toEqual({ value: 0 });
    expect(parsePercent('')).toEqual({ value: null });
    expect(parsePercent('1.234,5')).toEqual({ error: 'Enter a percentage, like 7.5' });
    expect(parsePercent('lots')).toEqual({ error: 'Enter a percentage, like 7.5' });
    expect(parsePercent('101')).toEqual({ error: 'Between -100% and 100%' });
    expect(parsePercent('60', { min: 0, max: 50 })).toEqual({ error: 'Between 0% and 50%' });
    expect(parsePercent('-1', { min: 0, max: 50 })).toEqual({ error: 'Between 0% and 50%' });
  });

  it('writes returns in a few characters', () => {
    expect(formatReturn(7.8)).toBe('7.8%');
    expect(formatReturn(9.59)).toBe('9.6%');
    expect(formatReturn(9.59, 2)).toBe('9.59%');
    expect(formatReturn(-2.5)).toBe('-2.5%');
    expect(formatReturn(12)).toBe('12%');
  });
});
