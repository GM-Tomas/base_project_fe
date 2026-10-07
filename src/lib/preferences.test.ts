import { describe, expect, it } from 'vitest';
import { DEFAULT_ESTIMATE, DEFAULT_PREFERENCES, estimateProblems, normalizeEstimate, preferencesProblems, withDefaults } from './preferences';

describe('preferences', () => {
  it('are fine by default', () => {
    expect(estimateProblems(DEFAULT_ESTIMATE)).toEqual([]);
  });

  it('report what the API would refuse, field by field', () => {
    const problems = estimateProblems({
      contributionUsd: 1e9 + 1,
      years: 0,
      yieldMode: 'NOPE' as never,
      customYieldPct: -101,
      milestonesUsd: [1, 2, 3, 4, 5, 1e16],
      inflationPct: -0.5,
      contributionGrowthPct: 50.5,
    });
    expect(problems.map((p) => p.field)).toEqual([
      'estimate.contributionUsd',
      'estimate.years',
      'estimate.yieldMode',
      'estimate.customYieldPct',
      'estimate.milestonesUsd',
      'estimate.milestonesUsd',
      'estimate.inflationPct',
      'estimate.contributionGrowthPct',
    ]);
  });

  it('open Assets where they said Platforms, which the API still takes', () => {
    const saved = { ...DEFAULT_PREFERENCES, defaultView: 'platforms' as never };
    expect(withDefaults(saved).defaultView).toBe('assets');
    expect(preferencesProblems(saved)).toEqual([]);
    expect(preferencesProblems({ ...DEFAULT_PREFERENCES, defaultView: 'nope' as never })).toEqual([
      { field: 'defaultView', message: 'defaultView must be one of dashboard, platforms, assets, debts, estimate, history, settings' },
    ]);
  });

  it('are kept as the API keeps them', () => {
    expect(
      normalizeEstimate({ ...DEFAULT_ESTIMATE, contributionUsd: 10.555, customYieldPct: 1.005, milestonesUsd: [3, 1.005], inflationPct: 2.345 }),
    ).toMatchObject({ contributionUsd: 10.56, customYieldPct: 1.01, milestonesUsd: [1.01, 3], inflationPct: 2.35 });
  });
});
