import type {
  AvailableAssetClasses,
  EstimateParams,
  Holding,
  Milestone,
  Platform,
  Projection,
  Snapshot,
  WealthSummary,
} from '@/types/wealth';
import type { Api, HoldingInput } from './api';
import { ApiError } from './apiError';
import { normalizeLabel as label, platformKey } from './labels';

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

const SEED: [name: string, assetClass: string, platform: string, valueUsd: number][] = [
  ['Vanguard S&P 500 ETF (VOO)', 'Index Fund', 'Interactive Brokers', 42_350],
  ['Apple (AAPL)', 'Equity', 'Interactive Brokers', 12_800],
  ['Bitcoin', 'Crypto', 'Binance', 18_450],
  ['Ethereum', 'Crypto', 'Binance', 6_120],
  ['US Treasury 2027', 'Fixed Income', 'Balanz', 15_000],
  ['Savings account', 'Cash', 'Santander', 9_500],
  ['Emergency fund', 'Cash', 'Mercado Pago', 3_200],
];

const cents = (n: number) => Math.round(n * 100) / 100;
const tenths = (n: number) => Math.round(n * 10) / 10;
const total = (holdings: Holding[]) => cents(holdings.reduce((sum, h) => sum + h.valueUsd, 0));
const growthPct = (value: number, from: number) => (from > 0 ? tenths(((value - from) / from) * 100) : null);
const byName = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'base' }) || a.localeCompare(b);
const byValueThenName = (a: { name: string; value: number }, b: { name: string; value: number }) =>
  b.value - a.value || byName(a.name, b.name);
const platformType = (name: string) => PLATFORM_TYPES.get(name) ?? 'Other';

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

function monthsLater(now: Date, months: number) {
  const totalMonths = now.getUTCMonth() + months;
  const year = now.getUTCFullYear() + Math.floor(totalMonths / 12);
  return `${year}-${String((totalMonths % 12) + 1).padStart(2, '0')}`;
}

// The API's answers for a demo account, kept in memory: made-up holdings and nine monthly snapshots,
// changed by what the user does in this tab, gone on reload. Same rules as the API where the UI shows
// them: one spelling per platform, totals and percentages, YTD from the first snapshot of the year,
// compound monthly projections.
export function createMockApi(now: () => Date = () => new Date()): Api {
  let nextId = 1;
  const started = now();
  const holdings: Holding[] = SEED.map(([name, assetClass, platform, valueUsd], i) => {
    const at = new Date(Date.UTC(started.getUTCFullYear() - 1, i, 15)).toISOString();
    return { id: `demo-${nextId++}`, name, assetClass, platform, valueUsd, createdAt: at, updatedAt: at };
  });
  const snapshots: { id: string; capturedAt: string; totalValueUsd: number }[] = Array.from({ length: 9 }, (_, i) => ({
    id: `demo-snapshot-${i + 1}`,
    capturedAt: new Date(Date.UTC(started.getUTCFullYear(), started.getUTCMonth() - 9 + i, 1, 12)).toISOString(),
    totalValueUsd: cents(88_000 * 1.022 ** i),
  }));

  const withChange = (i: number): Snapshot => ({
    ...snapshots[i],
    changePctFromPrevious: i === 0 ? null : growthPct(snapshots[i].totalValueUsd, snapshots[i - 1].totalValueUsd),
  });

  const summary = (): WealthSummary => {
    const netWorth = total(holdings);
    const pct = (value: number) => (netWorth > 0 ? tenths((value / netWorth) * 100) : 0);
    const liquid = total(holdings.filter((h) => LIQUID_CLASSES.includes(h.assetClass)));
    // The year's first snapshot, else the earliest one.
    const year = now().getUTCFullYear();
    const yearStart = snapshots.find((s) => new Date(s.capturedAt).getUTCFullYear() === year);
    const baseline = yearStart ?? snapshots.at(0);
    const ytdGrowth = baseline ? growthPct(netWorth, baseline.totalValueUsd) : null;
    return {
      netWorth: { usd: netWorth },
      holdingsCount: holdings.length,
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
        illiquidPct: netWorth > 0 ? tenths(100 - pct(liquid)) : 0,
        liquidAssetClasses: LIQUID_CLASSES,
      },
      byAssetClass: groupBy(holdings, (h) => h.assetClass)
        .sort(byValueThenName)
        .map((g) => ({ assetClass: g.name, valueUsd: g.value, pct: pct(g.value), count: g.count })),
      byPlatform: groupBy(holdings, (h) => h.platform)
        .sort(byValueThenName)
        .map((g) => ({ name: g.name, type: platformType(g.name), valueUsd: g.value, pct: pct(g.value), count: g.count })),
    };
  };

  const estimate = ({ contribution, yieldPct, years }: EstimateParams): Projection => {
    const principal = total(holdings);
    const r = yieldPct / 100 / 12;
    const futureValue = (months: number) =>
      Math.max(0, r === 0 ? principal + contribution * months : principal * (1 + r) ** months + contribution * (((1 + r) ** months - 1) / r));
    const milestone = (amountUsd: number): Milestone => {
      for (let month = 0; month <= years * 12; month++) {
        if (futureValue(month) >= amountUsd) {
          return month === 0
            ? { amountUsd, status: 'ACHIEVED', monthsRequired: 0, targetMonth: null }
            : { amountUsd, status: 'REACHABLE', monthsRequired: month, targetMonth: monthsLater(now(), month) };
        }
      }
      return { amountUsd, status: 'OUT_OF_HORIZON', monthsRequired: null, targetMonth: null };
    };
    return {
      principalUsd: principal,
      monthlyContributionUsd: contribution,
      annualYieldPct: yieldPct,
      years,
      series: Array.from({ length: years + 1 }, (_, year) => {
        const fv = cents(futureValue(year * 12));
        const contributed = cents(principal + contribution * year * 12);
        return { year, futureValueUsd: fv, totalContributedUsd: contributed, interestEarnedUsd: cents(fv - contributed) };
      }),
      milestones: MILESTONES.map(milestone),
    };
  };

  return {
    getSummary: async () => summary(),
    getHoldings: async () => holdings.map((h) => ({ ...h })),
    createHolding: async (input: HoldingInput) => {
      // The API's checks and messages (its length limits aside). JSON has no NaN or Infinity, so the API
      // never gets one; here they're rejected rather than stored.
      const [name, assetClass, platform] = [label(input.name), label(input.assetClass), label(input.platform)];
      const errors: { field: string; message: string }[] = [];
      if (!name) errors.push({ field: 'name', message: 'Name is required' });
      if (!assetClass) errors.push({ field: 'assetClass', message: 'Asset class is required' });
      if (!platform) errors.push({ field: 'platform', message: 'Platform is required' });
      if (!Number.isFinite(input.valueUsd)) errors.push({ field: 'valueUsd', message: 'Value must be a number' });
      else if (input.valueUsd < 0) errors.push({ field: 'valueUsd', message: 'Value must not be negative' });
      else if (input.valueUsd > MAX_VALUE_USD) errors.push({ field: 'valueUsd', message: 'Value is too large' });
      if (errors.length) throw new ApiError(400, errors.map((e) => e.message).join('; '), errors);
      if (holdings.length >= MAX_HOLDINGS) {
        throw new ApiError(409, `You can track up to ${MAX_HOLDINGS} holdings. Remove one to add another.`);
      }

      const at = now().toISOString();
      const holding: Holding = {
        id: `demo-${nextId++}`,
        name,
        assetClass,
        // Spelled like the platform's earliest holding, as the API does.
        platform: holdings.find((h) => platformKey(h.platform) === platformKey(platform))?.platform ?? platform,
        valueUsd: cents(input.valueUsd),
        createdAt: at,
        updatedAt: at,
      };
      holdings.push(holding);
      return { ...holding };
    },
    deleteHolding: async (id: string) => {
      const index = holdings.findIndex((h) => h.id === id);
      if (index < 0) throw new ApiError(404, 'Holding not found');
      holdings.splice(index, 1);
    },
    getPlatforms: async (): Promise<Platform[]> => {
      // Holdings are kept oldest first, so a platform's first one is its earliest.
      const first = new Map<string, Holding>();
      for (const h of holdings) if (!first.has(h.platform)) first.set(h.platform, h);
      return [...first.values()]
        .map((h) => ({ name: h.platform, type: platformType(h.platform), createdAt: h.createdAt }))
        .sort((a, b) => byName(a.name, b.name));
    },
    getAssetClasses: async (): Promise<AvailableAssetClasses> => {
      const inUse = [...new Set(holdings.map((h) => h.assetClass))].sort(byName);
      return { defaults: DEFAULT_CLASSES, inUse, all: [...new Set([...DEFAULT_CLASSES, ...inUse])] };
    },
    getSnapshots: async () => snapshots.map((_, i) => withChange(i)),
    createSnapshot: async () => {
      // Taken to the second, one per second at most, as the API does.
      const capturedAt = new Date(Math.floor(now().getTime() / 1000) * 1000).toISOString();
      if (snapshots.some((s) => s.capturedAt === capturedAt)) {
        throw new ApiError(409, `A snapshot already exists for ${capturedAt.replace('.000Z', 'Z')}`);
      }
      if (snapshots.length >= MAX_SNAPSHOTS) throw new ApiError(409, `You've reached the limit of ${MAX_SNAPSHOTS} snapshots.`);
      snapshots.push({ id: `demo-snapshot-${snapshots.length + 1}`, capturedAt, totalValueUsd: total(holdings) });
      return withChange(snapshots.length - 1);
    },
    getEstimate: async (params: EstimateParams) => estimate(params),
  };
}
