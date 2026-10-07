import type { EstimatePreferences, HistoryPeriodPreset, Preferences, ViewType } from '@/types/wealth';
import { round2 } from './returns';

// What each user sets up the way they like it (how they left Estimate, the monthly checkpoint, the view to
// open on, History's period): the defaults, and the API's checks and messages for a PUT /preferences
// (base_project_go: PreferencesHandler).

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

/** The views the app can open on, in the navigation's order. */
export const START_VIEWS: ViewType[] = ['dashboard', 'assets', 'debts', 'estimate', 'history', 'settings'];
/** What the API takes: Platforms too, from before it was folded into Assets (it opens Assets). */
const API_START_VIEWS = ['dashboard', 'platforms', 'assets', 'debts', 'estimate', 'history', 'settings'];
export const HISTORY_PERIODS: HistoryPeriodPreset[] = ['1M', '3M', '6M', 'YTD', '1Y', '3Y', 'ALL'];

export const DEFAULT_PREFERENCES: Preferences = {
  estimate: DEFAULT_ESTIMATE,
  autoSnapshot: 'OFF',
  defaultView: 'dashboard',
  historyPeriod: '1Y',
  language: 'auto',
};

const LANGUAGES: Preferences['language'][] = ['auto', 'en', 'es'];

type FieldError = { field: string; message: string };

/** Preferences as read: what an older API leaves out, or a value this app doesn't know, takes its default. */
export function withDefaults(saved: Partial<Preferences>): Preferences {
  return {
    estimate: { ...DEFAULT_ESTIMATE, ...saved.estimate },
    autoSnapshot: saved.autoSnapshot === 'MONTHLY' ? 'MONTHLY' : 'OFF',
    defaultView:
      (saved.defaultView as string) === 'platforms'
        ? 'assets'
        : saved.defaultView && START_VIEWS.includes(saved.defaultView)
          ? saved.defaultView
          : DEFAULT_PREFERENCES.defaultView,
    historyPeriod:
      saved.historyPeriod && HISTORY_PERIODS.includes(saved.historyPeriod) ? saved.historyPeriod : DEFAULT_PREFERENCES.historyPeriod,
    language: saved.language && LANGUAGES.includes(saved.language) ? saved.language : DEFAULT_PREFERENCES.language,
  };
}

/** What the API finds wrong with the rest of the document (after estimate's problems, in its order). */
export function preferencesProblems(p: Omit<Preferences, 'estimate'>): FieldError[] {
  const errors: FieldError[] = [];
  if (p.autoSnapshot !== 'OFF' && p.autoSnapshot !== 'MONTHLY') {
    errors.push({ field: 'autoSnapshot', message: 'autoSnapshot must be one of OFF, MONTHLY' });
  }
  if (!API_START_VIEWS.includes(p.defaultView)) {
    errors.push({ field: 'defaultView', message: `defaultView must be one of ${API_START_VIEWS.join(', ')}` });
  }
  if (!HISTORY_PERIODS.includes(p.historyPeriod)) {
    errors.push({ field: 'historyPeriod', message: `historyPeriod must be one of ${HISTORY_PERIODS.join(', ')}` });
  }
  if (!LANGUAGES.includes(p.language)) {
    errors.push({ field: 'language', message: `language must be one of ${LANGUAGES.join(', ')}` });
  }
  return errors;
}

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
