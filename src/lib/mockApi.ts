import type { EstimateQuery, Holding, Milestone, Preferences, Projection, Snapshot, WealthSummary } from '@/types/wealth';
import type {
  Api,
  AssetClassInput,
  AssetClassPatch,
  ExpectedReturnItem,
  HoldingInput,
  HoldingPatch,
  MovementInput,
  MovementQuery,
  PastCheckpointInput,
  PlatformPatch,
} from './api';
import { ApiError } from './apiError';
import { debtBalances, monthAfter } from './amortization';
import { normalizeLabel as label, platformKey } from './labels';
import { createMockCustomization } from './mockCustomization';
import { createMockDebts } from './mockDebts';
import { BAD_WHEN, createMockLedger, parseWhen, type MockDebt, type MockLedger } from './mockLedger';
import {
  DEFAULT_ESTIMATE,
  DEFAULT_PREFERENCES,
  estimateProblems,
  MAX_MILESTONES,
  normalizeEstimate,
  preferencesProblems,
} from './preferences';
import { simulate } from './projection';
import { expectedReturnOf, RETURN_RANGE, round2, validReturn } from './returns';

// The API's own defaults and limits (base_project_go): the classes offered from the start, the ones
// counted as liquid, the Estimate view's two milestones, the largest amount a holding can have, and how
// many holdings and snapshots an account can keep.
const DEFAULT_CLASSES = ['Cash', 'Fixed Income', 'Index Fund', 'Equity', 'Crypto'];
const LIQUID_CLASSES = ['Cash', 'Equity', 'Crypto', 'Index Fund'];
const MILESTONES = [150_000, 250_000];
const MAX_VALUE_USD = 1e15;
const MAX_HOLDINGS = 1000;
const MAX_SNAPSHOTS = 5000;

// A Map: platform names are typed by users, and "__proto__" is just another platform.
const PLATFORM_TYPES = new Map([
  ['Interactive Brokers', 'Broker'],
  ['Balanz', 'Broker'],
  ['Binance', 'Exchange'],
  ['Santander', 'Bank'],
  ['Mercado Pago', 'Wallet'],
]);

// [name, class, platform, value, expected yearly return (null: not set)]
const SEED: [name: string, assetClass: string, platform: string, valueUsd: number, returnPct: number | null][] = [
  ['Vanguard S&P 500 ETF (VOO)', 'Index Fund', 'Interactive Brokers', 42_350, 8],
  ['Apple (AAPL)', 'Equity', 'Interactive Brokers', 12_800, 10],
  ['Bitcoin', 'Crypto', 'Binance', 18_450, 20],
  ['Ethereum', 'Crypto', 'Binance', 6_120, 20],
  ['US Treasury 2027', 'Fixed Income', 'Balanz', 15_000, 4.5],
  ['Savings account', 'Cash', 'Santander', 9_500, 0.5],
  ['Emergency fund', 'Cash', 'Mercado Pago', 3_200, null],
];

// What the demo's holdings were worth when added (the rest, their value now), and what happened to them
// since — days ago, newest last — so that each one ends up at its value above.
const SEED_OPENING = new Map([
  ['Vanguard S&P 500 ETF (VOO)', 40_000],
  ['Apple (AAPL)', 13_500],
  ['Bitcoin', 15_000],
  ['Ethereum', 6_200],
  ['US Treasury 2027', 14_700],
  ['Savings account', 10_600],
  ['Emergency fund', 2_000],
]);

// The demo's debts as they are now, added after the holdings ([month of last year, opening balance]).
const SEED_DEBTS: (Omit<MockDebt, 'id' | 'createdAt' | 'updatedAt'> & { month: number; opening: number })[] = [
  {
    name: 'Visa Gold', lender: 'Santander', kind: 'CREDIT_CARD', balanceUsd: 1_250, interestRatePct: 65,
    monthlyPaymentUsd: 300, dueDay: 10, notes: null, month: 7, opening: 1_500,
  },
  {
    name: 'Car loan', lender: 'Banco Galicia', kind: 'LOAN', balanceUsd: 8_400, interestRatePct: 12,
    monthlyPaymentUsd: 350, dueDay: 5, notes: 'Fixed rate, 36 payments', month: 8, opening: 9_100,
  },
];

type SeedMovement = {
  kind: 'GAIN' | 'LOSS' | 'DEPOSIT' | 'TRANSFER' | 'ADJUSTMENT' | 'DEBT_PAYMENT' | 'DEBT_CHARGE';
  holding?: string;
  to?: string;
  debt?: string;
  amountUsd: number;
  daysAgo: number;
  note?: string;
  edit?: true;
};
const SEED_ACTIVITY: SeedMovement[] = [
  { kind: 'ADJUSTMENT', holding: 'Ethereum', amountUsd: 80, daysAgo: 75, note: 'Fixed a typo', edit: true },
  { kind: 'GAIN', holding: 'Vanguard S&P 500 ETF (VOO)', amountUsd: 2_350, daysAgo: 41, edit: true },
  { kind: 'DEBT_PAYMENT', debt: 'Car loan', amountUsd: 350, daysAgo: 35 },
  { kind: 'GAIN', holding: 'US Treasury 2027', amountUsd: 300, daysAgo: 33, note: 'Coupon' },
  { kind: 'LOSS', holding: 'Apple (AAPL)', amountUsd: 700, daysAgo: 27 },
  { kind: 'DEBT_CHARGE', debt: 'Visa Gold', amountUsd: 350, daysAgo: 25, note: 'Groceries and fuel' },
  { kind: 'DEPOSIT', holding: 'Savings account', amountUsd: 700, daysAgo: 20, note: 'Salary' },
  { kind: 'DEBT_PAYMENT', debt: 'Visa Gold', holding: 'Savings account', amountUsd: 600, daysAgo: 15 },
  { kind: 'GAIN', holding: 'Bitcoin', amountUsd: 3_450, daysAgo: 12 },
  { kind: 'TRANSFER', holding: 'Savings account', to: 'Emergency fund', amountUsd: 1_200, daysAgo: 6 },
  { kind: 'DEBT_PAYMENT', debt: 'Car loan', amountUsd: 350, daysAgo: 5 },
];
const DAY_MS = 24 * 60 * 60 * 1000;

const cents = (n: number) => Math.round(n * 100) / 100;
const tenths = (n: number) => Math.round(n * 10) / 10;
const total = (holdings: Holding[]) => cents(holdings.reduce((sum, h) => sum + h.valueUsd, 0));
const growthPct = (value: number, from: number) => (from > 0 ? tenths(((value - from) / from) * 100) : null);
const byName = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'base' }) || a.localeCompare(b);
const byValueThenName = (a: { name: string; value: number }, b: { name: string; value: number }) =>
  b.value - a.value || byName(a.name, b.name);

function groupBy(holdings: Holding[], key: (h: Holding) => string) {
  const groups = new Map<string, Holding[]>();
  for (const h of holdings) {
    const name = key(h);
    const members = groups.get(name);
    if (members) members.push(h);
    else groups.set(name, [h]);
  }
  return [...groups].map(([name, members]) => ({ name, value: total(members), count: members.length }));
}

type FieldError = { field: string; message: string };

// The API's checks and messages for the holding fields that were sent (its length limits aside). JSON has
// no NaN or Infinity, so the API never gets one; here they're rejected rather than stored. null, which a
// PATCH could send, is a missing required field.
function holdingErrors(fields: Partial<Record<keyof HoldingInput, unknown>>): FieldError[] {
  const errors: FieldError[] = [];
  const text: [keyof HoldingInput, string][] = [['name', 'Name'], ['assetClass', 'Asset class'], ['platform', 'Platform']];
  for (const [field, title] of text) {
    if (!(field in fields)) continue;
    const value = fields[field];
    if (typeof value !== 'string' || !label(value)) errors.push({ field, message: `${title} is required` });
  }
  if ('valueUsd' in fields) {
    const value = fields.valueUsd;
    if (value === null) errors.push({ field: 'valueUsd', message: 'Value is required' });
    else if (typeof value !== 'number' || !Number.isFinite(value)) errors.push({ field: 'valueUsd', message: 'Value must be a number' });
    else if (value < 0) errors.push({ field: 'valueUsd', message: 'Value must not be negative' });
    else if (value > MAX_VALUE_USD) errors.push({ field: 'valueUsd', message: 'Value is too large' });
  }
  // A yearly return; null (a PATCH clearing it) is fine.
  const pct = fields.expectedReturnPct;
  if (pct !== undefined && pct !== null && !(typeof pct === 'number' && validReturn(pct))) {
    errors.push({ field: 'expectedReturnPct', message: RETURN_RANGE });
  }
  return errors;
}

// A holding's own return as kept (its effective one is worked out when it's read: see present).
const withReturn = (pct: number | null | undefined) => {
  const own = pct === undefined || pct === null ? null : round2(pct);
  return { expectedReturnPct: own, effectiveReturnPct: own };
};

const rejectInvalid = (errors: FieldError[]) => {
  if (errors.length) throw new ApiError(400, errors.map((e) => e.message).join('; '), errors);
};

// A past checkpoint as POST /wealth/snapshots checks one (WealthHandler, then model.NewManualSnapshot), with its
// messages: when (to the second, not after now), the net worth and, both or neither, what was owned and owed.
function pastCheckpoint(past: PastCheckpointInput, now: Date) {
  const errors: FieldError[] = [];
  const at = past.capturedAt ? parseWhen(past.capturedAt, '12:00:00.000') : null;
  if (!past.capturedAt) errors.push({ field: 'capturedAt', message: 'capturedAt is required with a past snapshot' });
  else if (!at) errors.push({ field: 'capturedAt', message: BAD_WHEN('capturedAt') });
  const total = past.totalValueUsd as number | null | undefined;
  if (total === undefined || total === null) errors.push({ field: 'totalValueUsd', message: 'totalValueUsd is required with a past snapshot' });
  else if (!(Math.abs(total) <= MAX_VALUE_USD)) {
    errors.push({ field: 'totalValueUsd', message: 'totalValueUsd must be between -1000000000000000 and 1000000000000000' });
  }
  for (const field of ['assetsUsd', 'debtsUsd'] as const) {
    const v = past[field];
    if (v !== undefined && !(v >= 0 && v <= MAX_VALUE_USD)) errors.push({ field, message: `${field} must be between 0 and 1000000000000000` });
  }
  rejectInvalid(errors);
  const capturedAt = new Date(Math.floor(at!.getTime() / 1000) * 1000);
  if (capturedAt.getTime() < 0 || capturedAt.getTime() > now.getTime()) throw new ApiError(400, 'capturedAt must be in the past, from 1970 on');
  const note = (past.note ?? '').trim();
  if ([...note].length > 200) throw new ApiError(400, `Note exceeds max length (${[...note].length} > 200)`);
  const net = cents(total!);
  if ((past.assetsUsd === undefined) !== (past.debtsUsd === undefined)) {
    throw new ApiError(400, 'assetsUsd and debtsUsd go together: send both or neither');
  }
  let [assetsUsd, debtsUsd] = net < 0 ? [0, -net] : [net, 0];
  if (past.assetsUsd !== undefined) {
    [assetsUsd, debtsUsd] = [cents(past.assetsUsd), cents(past.debtsUsd!)];
    if (cents(assetsUsd - debtsUsd) !== net) throw new ApiError(400, 'totalValueUsd must be assetsUsd − debtsUsd');
  }
  return { capturedAt: capturedAt.toISOString(), totalValueUsd: net, assetsUsd, debtsUsd, source: 'MANUAL' as const, note: note || null };
}

// The demo's activity log: each holding's and debt's OPENING when it was added, then SEED_ACTIVITY.
function seedActivity(ledger: MockLedger, holdings: Holding[], debts: MockDebt[], started: Date) {
  const named = (name: string) => holdings.find((h) => h.name === name)!;
  const nothing = { feeUsd: null, previousValueUsd: null, newValueUsd: null, note: null };
  for (const h of holdings) {
    const amountUsd = SEED_OPENING.get(h.name) ?? h.valueUsd;
    ledger.seed({ ...nothing, kind: 'OPENING', occurredAt: h.createdAt, createdAt: h.createdAt, amountUsd, holding: h });
  }
  for (const d of debts) {
    const amountUsd = SEED_DEBTS.find((s) => s.name === d.name)!.opening;
    ledger.seed({ ...nothing, kind: 'OPENING', occurredAt: d.createdAt, createdAt: d.createdAt, amountUsd, debt: d });
  }
  const values = new Map(holdings.map((h) => [h.name, SEED_OPENING.get(h.name) ?? h.valueUsd]));
  for (const m of SEED_ACTIVITY) {
    const at = new Date(started.getTime() - m.daysAgo * DAY_MS).toISOString();
    const debt = m.debt ? debts.find((d) => d.name === m.debt) : undefined;
    const previous = m.holding ? values.get(m.holding)! : 0;
    const down = ['LOSS', 'TRANSFER', 'ADJUSTMENT', 'DEBT_PAYMENT'].includes(m.kind);
    const next = down ? previous - m.amountUsd : previous + m.amountUsd;
    if (m.holding) values.set(m.holding, next);
    if (m.to) values.set(m.to, values.get(m.to)! + m.amountUsd);
    ledger.seed({
      kind: m.kind, occurredAt: at, createdAt: at, amountUsd: m.amountUsd, feeUsd: m.kind === 'TRANSFER' ? 0 : null,
      holding: m.holding ? named(m.holding) : undefined, toHolding: m.to ? named(m.to) : undefined, debt,
      previousValueUsd: m.edit ? previous : null, newValueUsd: m.edit ? next : null, note: m.note ?? null,
    });
  }
}

// The API's answers for a demo account, kept in memory: made-up holdings and debts, their activity and nine
// monthly snapshots, changed by what the user does in this tab, gone on reload. Same rules as the API where
// the UI shows them: one spelling per platform, totals and percentages, net worth as assets minus debts, YTD
// from the first snapshot of the year, compound monthly projections with debts paid off on their own terms,
// movements and what they do to values.
export function createMockApi(now: () => Date = () => new Date()): Api {
  let nextId = 1;
  const started = now();
  const holdings: Holding[] = SEED.map(([name, assetClass, platform, valueUsd, returnPct], i) => {
    const at = new Date(Date.UTC(started.getUTCFullYear() - 1, i, 15)).toISOString();
    return { id: `demo-${nextId++}`, name, assetClass, platform, valueUsd, ...withReturn(returnPct), createdAt: at, updatedAt: at };
  });
  const debts: MockDebt[] = SEED_DEBTS.map(({ month, opening, ...debt }) => {
    const at = new Date(Date.UTC(started.getUTCFullYear() - 1, month, 15)).toISOString();
    return { ...debt, id: `demo-debt-${nextId++}`, createdAt: at, updatedAt: at };
  });
  // Nine months of a growing net worth, while the debts were paid down.
  const snapshots: Omit<Snapshot, 'changePctFromPrevious'>[] = Array.from({ length: 9 }, (_, i) => {
    const [net, owed] = [cents(80_000 * 1.022 ** i), cents(9_650 + 300 * (9 - i))];
    return {
      id: `demo-snapshot-${i + 1}`,
      capturedAt: new Date(Date.UTC(started.getUTCFullYear(), started.getUTCMonth() - 9 + i, 1, 12)).toISOString(),
      totalValueUsd: net,
      assetsUsd: cents(net + owed),
      debtsUsd: owed,
      source: 'AUTO' as const,
      note: null,
    };
  });

  // A platform as the API spells it: like its earliest holding (holdings are kept oldest first), else as given.
  const spelled = (platform: string) =>
    holdings.find((h) => platformKey(h.platform) === platformKey(platform))?.platform ?? platform;

  // A holding validated as POST /holdings validates one, added once its cap is checked.
  const newHolding = (input: HoldingInput) => {
    rejectInvalid(holdingErrors(input));
    const [name, assetClass, platform] = [label(input.name), label(input.assetClass), label(input.platform)];
    return {
      checkCap: () => {
        if (holdings.length >= MAX_HOLDINGS) {
          throw new ApiError(409, `You can track up to ${MAX_HOLDINGS} holdings. Remove one to add another.`);
        }
      },
      add: (): Holding => {
        const at = now().toISOString();
        const holding = {
          id: `demo-${nextId++}`,
          name,
          assetClass,
          platform: spelled(platform),
          valueUsd: cents(input.valueUsd),
          ...withReturn(input.expectedReturnPct),
          createdAt: at,
          updatedAt: at,
        };
        holdings.push(holding);
        return holding;
      },
    };
  };
  const ledger = createMockLedger({ holdings, debts, now, newHolding: (input) => newHolding({ ...input, valueUsd: 0 }) });
  seedActivity(ledger, holdings, debts, started);
  const debtsApi = createMockDebts({ debts, ledger, now, nextId: () => `demo-debt-${nextId++}` });
  const custom = createMockCustomization({
    holdings,
    defaultClasses: DEFAULT_CLASSES,
    liquidClasses: LIQUID_CLASSES,
    legacyType: (name) => PLATFORM_TYPES.get(name) ?? null,
  });
  // A holding as the API answers with it: the return it counts with is its own, or else its class's.
  const present = (h: Holding): Holding => ({ ...h, effectiveReturnPct: h.expectedReturnPct ?? custom.classReturn(h.assetClass) });
  const owed = () => cents(debts.reduce((sum, d) => sum + d.balanceUsd, 0));

  // Ids are never reused, also after a snapshot is deleted.
  let nextSnapshotId = snapshots.length + 1;

  const withChange = (i: number): Snapshot => ({
    ...snapshots[i],
    changePctFromPrevious: i === 0 ? null : growthPct(snapshots[i].totalValueUsd, snapshots[i - 1].totalValueUsd),
  });

  const summary = (): WealthSummary => {
    const assets = total(holdings);
    const debtsUsd = owed();
    const netWorth = cents(assets - debtsUsd);
    // Shares of what's owned: the net worth can be zero or below.
    const pct = (value: number) => (assets > 0 ? tenths((value / assets) * 100) : 0);
    const liquid = total(holdings.filter((h) => custom.liquid(h.assetClass)));
    // The year's first snapshot, else the earliest one.
    const year = now().getUTCFullYear();
    const yearStart = snapshots.find((s) => new Date(s.capturedAt).getUTCFullYear() === year);
    const baseline = yearStart ?? snapshots.at(0);
    const ytdGrowth = baseline ? growthPct(netWorth, baseline.totalValueUsd) : null;
    return {
      netWorth: { usd: netWorth },
      assets: { usd: assets },
      debts: {
        usd: debtsUsd,
        count: debts.length,
        monthlyPaymentUsd: cents(debts.reduce((sum, d) => sum + (d.monthlyPaymentUsd ?? 0), 0)),
      },
      holdingsCount: holdings.length,
      expectedReturn: expectedReturnOf(holdings.map(present)),
      ytd:
        baseline && ytdGrowth !== null
          ? {
              basis: yearStart ? 'YEAR_START_SNAPSHOT' : 'EARLIEST_SNAPSHOT',
              growthPct: ytdGrowth,
              baselineValueUsd: baseline.totalValueUsd,
              baselineAt: baseline.capturedAt,
            }
          : { basis: 'NO_BASELINE', growthPct: 0 },
      liquidity: {
        liquidPct: pct(liquid),
        illiquidPct: assets > 0 ? tenths(100 - pct(liquid)) : 0,
        liquidAssetClasses: custom.liquidClasses(),
      },
      byAssetClass: groupBy(holdings, (h) => h.assetClass)
        .sort(byValueThenName)
        .map((g) => ({
          assetClass: g.name, valueUsd: g.value, pct: pct(g.value), count: g.count,
          color: custom.classColor(g.name), liquid: custom.liquid(g.name),
        })),
      byPlatform: groupBy(holdings, (h) => h.platform)
        .sort(byValueThenName)
        .map((g) => ({ name: g.name, ...custom.look(g.name), valueUsd: g.value, pct: pct(g.value), count: g.count })),
    };
  };

  // The API's checks of an estimate's parameters (WealthHandler.GetEstimate), all reported at once.
  const estimateErrors = (q: EstimateQuery) => {
    const errors: FieldError[] = [];
    const inRange = (v: number | undefined, min: number, max: number) => v === undefined || (v >= min && v <= max);
    if (!inRange(q.contribution, 0, 1e9)) errors.push({ field: 'contribution', message: 'contribution must be between 0 and 1000000000' });
    if (!inRange(q.yieldPct, -100, 100)) errors.push({ field: 'yieldPct', message: 'yieldPct must be between -100 and 100' });
    if (!Number.isInteger(q.years) || !inRange(q.years, 1, 50)) errors.push({ field: 'years', message: 'years must be between 1 and 50' });
    if (q.milestones && (q.milestones.length > MAX_MILESTONES || !q.milestones.every((m) => inRange(m, 0, 1e15)))) {
      errors.push({ field: 'milestones', message: 'milestones must be up to 5 comma-separated amounts between 0 and 1000000000000000' });
    }
    if (!inRange(q.inflationPct, 0, 50)) errors.push({ field: 'inflationPct', message: 'inflationPct must be between 0 and 50' });
    if (!inRange(q.contributionGrowthPct, 0, 50)) {
      errors.push({ field: 'contributionGrowthPct', message: 'contributionGrowthPct must be between 0 and 50' });
    }
    return errors;
  };

  // The portfolio (the assets) grows month by month, at the portfolio's expected return unless told
  // otherwise; each debt is paid off on its own terms; the net worth is what's left. Milestones are on the
  // nominal net worth.
  const estimate = (q: EstimateQuery): Projection => {
    rejectInvalid(estimateErrors(q));
    const principal = total(holdings);
    const portfolio = expectedReturnOf(holdings.map(present)).weightedPct;
    const yieldPct = q.yieldPct ?? portfolio ?? 0;
    const [inflationPct, contributionGrowthPct] = [q.inflationPct ?? 0, q.contributionGrowthPct ?? 0];
    const months = simulate({ principal, contribution: q.contribution, yieldPct, years: q.years, contributionGrowthPct, inflationPct });
    const owedBy = Array.from({ length: q.years * 12 + 1 }, () => 0);
    for (const d of debts) debtBalances(d, q.years * 12).forEach((balance, m) => (owedBy[m] = cents(owedBy[m] + balance)));
    const milestone = (amountUsd: number): Milestone => {
      const month = months.findIndex((state, m) => cents(state.value) - owedBy[m] >= amountUsd);
      if (month < 0) return { amountUsd, status: 'OUT_OF_HORIZON', monthsRequired: null, targetMonth: null };
      return month === 0
        ? { amountUsd, status: 'ACHIEVED', monthsRequired: 0, targetMonth: null }
        : { amountUsd, status: 'REACHABLE', monthsRequired: month, targetMonth: monthAfter(now(), month) };
    };
    return {
      principalUsd: principal,
      debtsUsd: owed(),
      monthlyContributionUsd: q.contribution,
      annualYieldPct: yieldPct,
      yieldSource: q.yieldPct === undefined ? 'PORTFOLIO' : 'CUSTOM',
      portfolioYieldPct: portfolio,
      inflationPct,
      contributionGrowthPct,
      years: q.years,
      series: Array.from({ length: q.years + 1 }, (_, year) => {
        const state = months[year * 12];
        const fv = cents(state.value);
        const contributed = cents(state.contributed);
        const debt = owedBy[year * 12];
        const netWorth = cents(fv - debt);
        return {
          year,
          futureValueUsd: fv,
          totalContributedUsd: contributed,
          interestEarnedUsd: cents(fv - contributed),
          debtBalanceUsd: debt,
          netWorthUsd: netWorth,
          realFutureValueUsd: cents(fv / state.deflator),
          realNetWorthUsd: cents(netWorth / state.deflator),
        };
      }),
      milestones: [...(q.milestones ?? DEFAULT_ESTIMATE.milestonesUsd)].sort((a, b) => a - b).map(milestone),
    };
  };

  // What the user saved (PUT /preferences replaces it whole; what it leaves out takes its default).
  let preferences: Preferences | null = null;
  const savePreferences = async (sent: Preferences): Promise<Preferences> => {
    const e = { ...DEFAULT_ESTIMATE, ...sent.estimate };
    // JSON's 1.5 isn't an int: the API can't even read the body.
    if (!Number.isInteger(e.years)) throw new ApiError(400, 'Malformed JSON body');
    const rest = {
      autoSnapshot: sent.autoSnapshot ?? DEFAULT_PREFERENCES.autoSnapshot,
      defaultView: sent.defaultView ?? DEFAULT_PREFERENCES.defaultView,
      historyPeriod: sent.historyPeriod ?? DEFAULT_PREFERENCES.historyPeriod,
    };
    rejectInvalid([...estimateProblems(e), ...preferencesProblems(rest)]);
    preferences = { estimate: normalizeEstimate(e), ...rest };
    return structuredClone(preferences);
  };

  // PUT /holdings/expected-returns: checked as the handler checks the items (every problem at once), then
  // all of them or, if one isn't the user's, none.
  const setExpectedReturns = async (items: ExpectedReturnItem[] | undefined): Promise<Holding[]> => {
    if (!items) rejectInvalid([{ field: 'items', message: 'items is required' }]);
    if (items!.length > MAX_HOLDINGS) rejectInvalid([{ field: 'items', message: `items can't have more than ${MAX_HOLDINGS} entries` }]);
    const errors: FieldError[] = [];
    const seen = new Set<string>();
    items!.forEach((item, i) => {
      const field = `items[${i}]`;
      if (!item.holdingId?.trim()) errors.push({ field: `${field}.holdingId`, message: `${field}.holdingId is required` });
      else if (seen.has(item.holdingId)) errors.push({ field: `${field}.holdingId`, message: `${field}.holdingId appears more than once` });
      seen.add(item.holdingId);
      const pct = item.expectedReturnPct as number | null | undefined;
      if (pct === undefined) {
        errors.push({ field: `${field}.expectedReturnPct`, message: `${field}.expectedReturnPct is required (null clears it)` });
      } else if (pct !== null && !validReturn(pct)) {
        errors.push({ field: `${field}.expectedReturnPct`, message: `${field}.${RETURN_RANGE}` });
      }
    });
    rejectInvalid(errors);
    const found = items!.map((item) => {
      const h = holdings.find((x) => x.id === item.holdingId);
      if (!h) throw new ApiError(404, `Holding ${item.holdingId} not found`);
      return h;
    });
    const at = now().toISOString();
    items!.forEach((item, i) => {
      const next = withReturn(item.expectedReturnPct);
      if (found[i].expectedReturnPct !== next.expectedReturnPct) Object.assign(found[i], next, { updatedAt: at });
    });
    return found.map(present);
  };

  return {
    getSummary: async () => summary(),
    getHoldings: async () => holdings.map(present),
    createHolding: async (input: HoldingInput) => {
      // Added with its OPENING; the cap, then the activity quota, as the API checks them.
      const fresh = newHolding(input);
      fresh.checkCap();
      ledger.roomForOneMore();
      const holding = fresh.add();
      ledger.opened(holding);
      return present(holding);
    },
    updateHolding: async (id: string, patch: HoldingPatch) => {
      // Only what's sent changes; sending what's there writes nothing (updatedAt stays). A new value is
      // recorded as what valueChangeReason says it was; a new return alone records nothing.
      rejectInvalid(holdingErrors(patch));
      const edit = ledger.checkEdit(patch.valueChangeReason, patch.occurredAt, patch.note);
      const holding = holdings.find((h) => h.id === id);
      if (!holding) throw new ApiError(404, `Holding ${id} not found`);
      const updated: Holding = {
        ...holding,
        ...(patch.name !== undefined && { name: label(patch.name) }),
        ...(patch.assetClass !== undefined && { assetClass: label(patch.assetClass) }),
        ...(patch.platform !== undefined && { platform: spelled(label(patch.platform)) }),
        ...(patch.valueUsd !== undefined && { valueUsd: cents(patch.valueUsd) }),
        ...(patch.expectedReturnPct !== undefined && withReturn(patch.expectedReturnPct)),
      };
      const changed = (['name', 'assetClass', 'platform', 'valueUsd', 'expectedReturnPct'] as const).some((k) => updated[k] !== holding[k]);
      if (!changed) return present(holding);
      const previous = holding.valueUsd;
      if (updated.valueUsd !== previous) ledger.roomForOneMore();
      Object.assign(holding, updated, { updatedAt: now().toISOString() });
      if (holding.valueUsd !== previous) ledger.edited(holding, previous, edit);
      return present(holding);
    },
    deleteHolding: async (id: string) => {
      const index = holdings.findIndex((h) => h.id === id);
      if (index < 0) throw new ApiError(404, `Holding ${id} not found`);
      ledger.closed(holdings[index]);
      holdings.splice(index, 1);
    },
    ...debtsApi,
    getMovements: async (query?: MovementQuery) => ledger.list(query),
    createMovement: async (input: MovementInput) => ledger.record(input),
    deleteMovement: async (id: string) => ledger.revert(id),
    getPlatforms: async () => custom.getPlatforms(),
    updatePlatform: async (id: string, patch: PlatformPatch) => custom.updatePlatform(id, patch),
    getAssetClasses: async () => custom.getAssetClasses(),
    createAssetClass: async (input: AssetClassInput) => custom.createAssetClass(input),
    updateAssetClass: async (id: string, patch: AssetClassPatch) => custom.updateAssetClass(id, patch),
    deleteAssetClass: async (id: string, moveTo?: string) => custom.deleteAssetClass(id, moveTo),
    getSnapshots: async () => snapshots.map((_, i) => withChange(i)),
    createSnapshot: async (past?: PastCheckpointInput) => {
      // Today's, or a past one the user enters: taken to the second, one per second at most, as the API does.
      // A body with nothing in it is as good as none.
      const empty = !past || (!past.capturedAt && past.totalValueUsd == null && past.assetsUsd == null && past.debtsUsd == null && !past.note);
      const kept = empty ? null : pastCheckpoint(past, now());
      const capturedAt = kept?.capturedAt ?? new Date(Math.floor(now().getTime() / 1000) * 1000).toISOString();
      if (snapshots.some((s) => s.capturedAt === capturedAt)) {
        throw new ApiError(409, `A snapshot already exists for ${capturedAt.replace('.000Z', 'Z')}`);
      }
      if (snapshots.length >= MAX_SNAPSHOTS) throw new ApiError(409, `You've reached the limit of ${MAX_SNAPSHOTS} snapshots.`);
      const [assets, debtsUsd] = [total(holdings), owed()];
      const snapshot = kept
        ? { id: `demo-snapshot-${nextSnapshotId++}`, ...kept }
        : {
            id: `demo-snapshot-${nextSnapshotId++}`,
            capturedAt,
            totalValueUsd: cents(assets - debtsUsd),
            assetsUsd: assets,
            debtsUsd,
            source: 'AUTO' as const,
            note: null,
          };
      // Kept in order: a past one goes where it belongs.
      const at = snapshots.findIndex((s) => s.capturedAt > capturedAt);
      const index = at < 0 ? snapshots.length : at;
      snapshots.splice(index, 0, snapshot);
      return withChange(index);
    },
    getMovementsSummary: async (period?: { from?: string; to?: string }) => ledger.summary(period),
    deleteSnapshot: async (id: string) => {
      const index = snapshots.findIndex((s) => s.id === id);
      if (index < 0) throw new ApiError(404, `Snapshot ${id} not found`);
      snapshots.splice(index, 1);
    },
    getEstimate: async (params: EstimateQuery) => estimate(params),
    setExpectedReturns,
    getPreferences: async () => structuredClone(preferences ?? DEFAULT_PREFERENCES),
    savePreferences,
  };
}
