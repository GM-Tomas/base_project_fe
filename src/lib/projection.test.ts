import { describe, expect, it } from 'vitest';
import { simulate } from './projection';

// The same cases as the API's (base_project_go: compound_interest_calculator_test.go).
const closedForm = (principal: number, contribution: number, yieldPct: number, months: number) => {
  const r = yieldPct / 100 / 12;
  if (r === 0) return principal + contribution * months;
  const compound = (1 + r) ** months;
  return principal * compound + contribution * ((compound - 1) / r);
};

describe('simulate', () => {
  it('matches the closed formula without a raise', () => {
    for (const [principal, contribution, yieldPct] of [
      [84_250, 900, 9],
      [0, 1_000, 5.5],
      [500_000, 2_500, -3],
    ]) {
      const months = simulate({ principal, contribution, yieldPct, years: 50 });
      expect(months).toHaveLength(601);
      for (const m of [0, 12, 120, 600]) expect(months[m].value).toBeCloseTo(closedForm(principal, contribution, yieldPct, m), 4);
    }
    expect(simulate({ principal: 50_000, contribution: 1_000, yieldPct: 10, years: 10 })[120].value).toBeCloseTo(340_197.05, 2);
  });

  it('raises the contribution each year, and deflates by inflation', () => {
    const months = simulate({ principal: 0, contribution: 100, yieldPct: 0, years: 3, contributionGrowthPct: 10, inflationPct: 12 });
    expect(months[12].contributed).toBe(1_200);
    expect(months[24].contributed).toBeCloseTo(2_520, 6);
    expect(months[36].contributed).toBeCloseTo(3_972, 6);
    expect(months[12].deflator).toBeCloseTo(1.01 ** 12, 10);
  });

  it('never goes below nothing', () => {
    expect(simulate({ principal: 1_000, contribution: 0, yieldPct: -100, years: 50 })[600].value).toBeGreaterThanOrEqual(0);
  });
});
