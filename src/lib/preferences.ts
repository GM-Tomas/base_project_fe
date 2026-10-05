import type { EstimatePreferences, Preferences } from '@/types/wealth';
import { round2 } from './returns';

// What each user sets up the way they like it (how they left Estimate): the defaults, and the API's checks
// and messages for a PUT /preferences (base_project_go: PreferencesHandler).

export const MAX_MILESTONES = 5;
export const MAX_CONTRIBUTION_USD = 1e9;
export const MAX_MILESTONE_USD = 1e15;
export const MAX_YEARS = 50;
export const MAX_ADJUSTMENT_PCT = 50;

export const DEFAULT_ESTIMATE: EstimatePreferences = {
  contributionUsd: 900,
  years: 12,
  yieldMode: 'PORTFOLIO',
  customYieldPct: 9,
  milestonesUsd: [150_000, 250_000],
  inflationPct: 0,
  contributionGrowthPct: 0,
};

export const DEFAULT_PREFERENCES: Preferences = { estimate: DEFAULT_ESTIMATE };

type FieldError = { field: string; message: string };

const inRange = (v: number, min: number, max: number) => v >= min && v <= max;

/** Every problem the API finds with how Estimate is set up, in its order (fields are estimate.*). */
export function estimateProblems(e: EstimatePreferences): FieldError[] {
  const errors: FieldError[] = [];
  const check = (field: string, ok: boolean, message: string) => {
    if (!ok) errors.push({ field: `estimate.${field}`, message });
  };
  check('contributionUsd', inRange(e.contributionUsd, 0, MAX_CONTRIBUTION_USD), 'contributionUsd must be between 0 and 1000000000');
  check('years', inRange(e.years, 1, MAX_YEARS), 'years must be between 1 and 50');
  check('yieldMode', e.yieldMode === 'PORTFOLIO' || e.yieldMode === 'CUSTOM', 'yieldMode must be one of PORTFOLIO, CUSTOM');
  check('customYieldPct', inRange(e.customYieldPct, -100, 100), 'customYieldPct must be between -100 and 100');
  check('milestonesUsd', e.milestonesUsd.length <= MAX_MILESTONES, `at most ${MAX_MILESTONES} milestones`);
  check(
    'milestonesUsd',
    e.milestonesUsd.every((m) => inRange(m, 0, MAX_MILESTONE_USD)),
    'milestones must be amounts between 0 and 1000000000000000',
  );
  check('inflationPct', inRange(e.inflationPct, 0, MAX_ADJUSTMENT_PCT), 'inflationPct must be between 0 and 50');
  check(
    'contributionGrowthPct',
    inRange(e.contributionGrowthPct, 0, MAX_ADJUSTMENT_PCT),
    'contributionGrowthPct must be between 0 and 50',
  );
  return errors;
}

/** How the API keeps them: amounts in cents, percentages to 2 decimals (both rounded alike), milestones in order. */
export function normalizeEstimate(e: EstimatePreferences): EstimatePreferences {
  return {
    ...e,
    contributionUsd: round2(e.contributionUsd),
    customYieldPct: round2(e.customYieldPct),
    milestonesUsd: e.milestonesUsd.map(round2).sort((a, b) => a - b),
    inflationPct: round2(e.inflationPct),
    contributionGrowthPct: round2(e.contributionGrowthPct),
  };
}
