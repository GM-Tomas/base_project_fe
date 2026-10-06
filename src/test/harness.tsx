import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import HomePage from '@/app/page';
import { AuthProvider } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import type {
  AssetClassInfo,
  AvailableAssetClasses,
  Holding,
  Platform,
  Projection,
  ProjectionPoint,
  Snapshot,
  WealthSummary,
} from '@/types/wealth';
import { DEFAULT_PREFERENCES } from '@/lib/preferences';

// The app tests' harness: the whole app runs for real; only Supabase (see setup.ts) and the backend (fetch)
// are faked. A test file calls installFakeBackend() once, then changes `routes` to make the backend answer
// differently.

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const SESSION = {
  access_token: 'tok',
  user: { id: 'u1', email: 'ana@example.com', user_metadata: { full_name: 'Ana Pérez' } },
} as unknown as Session;

export const summary = (over: Partial<WealthSummary> = {}): WealthSummary => ({
  netWorth: { usd: 12345.6 },
  assets: { usd: 12345.6 },
  debts: { usd: 0, count: 0, monthlyPaymentUsd: 0 },
  holdingsCount: 3,
  expectedReturn: { weightedPct: 5.18, coveragePct: 64.8, annualUsd: 640 },
  ytd: { basis: 'YEAR_START_SNAPSHOT', growthPct: 12.34 },
  liquidity: { liquidPct: 70, illiquidPct: 30, liquidAssetClasses: ['Equity'] },
  byAssetClass: [
    { assetClass: 'Equity', valueUsd: 8000, pct: 64.8, count: 1, color: null, liquid: true },
    { assetClass: 'Gold', valueUsd: 4345.6, pct: 35.2, count: 2, color: null, liquid: false },
  ],
  byPlatform: [
    { name: 'Vault', type: 'Safe', valueUsd: 4345.6, pct: 35.2, count: 2, avatarText: null, color: null },
    { name: 'Balanz', type: 'Broker', valueUsd: 8000, pct: 64.8, count: 1, avatarText: null, color: null },
    { name: 'Empty', type: 'Bank', valueUsd: 0, pct: 0, count: 0, avatarText: null, color: null },
  ],
  ...over,
});

export const holding = (
  id: string,
  name: string,
  assetClass: string,
  platform: string,
  valueUsd: number,
  expectedReturnPct: number | null = null,
): Holding => ({
  id, name, assetClass, platform, valueUsd, expectedReturnPct, effectiveReturnPct: expectedReturnPct,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
});

// SPY expects 8% a year (the summary's 5.18% for the whole portfolio, 64.8% of it covered).
export const HOLDINGS = [
  holding('h1', 'SPY', 'Equity', 'Balanz', 8000, 8),
  holding('h2', 'Gold bar', 'Gold', 'Vault', 4000),
  holding('h3', 'Coins', 'Gold', 'Vault', 345.6),
];

export const platform = (name: string, over: Partial<Platform> = {}): Platform => ({
  id: `id-${name}`, name, type: 'Other', avatarText: null, color: null, holdingsCount: 0, valueUsd: 0, createdAt: '', ...over,
});

export const PLATFORMS: Platform[] = [
  platform('Balanz', { holdingsCount: 1, valueUsd: 8000 }),
  platform('Vault', { holdingsCount: 2, valueUsd: 4345.6 }),
  platform('Empty'),
];

export const assetClass = (name: string, over: Partial<AssetClassInfo> = {}): AssetClassInfo => ({
  id: `id-${name}`, name, color: null, liquid: false, expectedReturnPct: null, isDefault: false, holdingsCount: 0, valueUsd: 0, ...over,
});

export const ASSET_CLASSES: AvailableAssetClasses = {
  defaults: ['Cash'],
  inUse: ['Equity', 'Gold'],
  all: ['Cash', 'Equity', 'Gold'],
  classes: [
    assetClass('Cash', { isDefault: true, liquid: true }),
    assetClass('Equity', { liquid: true, holdingsCount: 1, valueUsd: 8000 }),
    assetClass('Gold', { holdingsCount: 2, valueUsd: 4345.6 }),
  ],
};

export const snapshot = (id: string, capturedAt: string, totalValueUsd: number, changePctFromPrevious: number | null): Snapshot => ({
  id, capturedAt, totalValueUsd, assetsUsd: totalValueUsd, debtsUsd: 0, changePctFromPrevious,
});

export const SNAPSHOTS = [
  snapshot('s1', '2026-01-15T12:00:00Z', 10000, null),
  snapshot('s2', '2026-02-15T12:00:00Z', 11000, 10),
  snapshot('s3', '2026-03-15T12:00:00Z', 11000, 0),
  snapshot('s4', '2026-04-15T12:00:00Z', 9000, -18.2),
];

/** A year of a projection, without debts or inflation (the real values are the same). */
export const point = (year: number, futureValueUsd: number, totalContributedUsd: number, over: Partial<ProjectionPoint> = {}): ProjectionPoint => ({
  year,
  futureValueUsd,
  totalContributedUsd,
  interestEarnedUsd: Math.round((futureValueUsd - totalContributedUsd) * 100) / 100,
  debtBalanceUsd: 0,
  netWorthUsd: futureValueUsd,
  realFutureValueUsd: futureValueUsd,
  realNetWorthUsd: futureValueUsd,
  ...over,
});

export const projection = (over: Partial<Projection> = {}): Projection => ({
  principalUsd: 12345.6,
  debtsUsd: 0,
  monthlyContributionUsd: 900,
  annualYieldPct: 5.18,
  yieldSource: 'PORTFOLIO',
  portfolioYieldPct: 5.18,
  inflationPct: 0,
  contributionGrowthPct: 0,
  years: 12,
  series: [point(0, 12345.6, 12345.6), point(1, 25000, 23145.6)],
  milestones: [
    { amountUsd: 50000, status: 'REACHABLE', monthsRequired: 30, targetMonth: '2029-03' },
    { amountUsd: 123456, status: 'OUT_OF_HORIZON', monthsRequired: null, targetMonth: null },
  ],
  ...over,
});

export type Route = (init: RequestInit) => Response | Promise<Response>;
export let routes: Record<string, Route>;
export let fetchMock: ReturnType<typeof vi.fn>;
export let authListener: (event: string, session: Session | null) => void;

export function installFakeBackend() {
  beforeEach(() => {
    routes = {
      'GET /api/v1/wealth/summary': () => json(summary()),
      'GET /api/v1/holdings': () => json(HOLDINGS),
      'GET /api/v1/platforms': () => json(PLATFORMS),
      'GET /api/v1/asset-classes': () => json(ASSET_CLASSES),
      'GET /api/v1/wealth/snapshots': () => json(SNAPSHOTS),
      'GET /api/v1/wealth/estimate': () => json(projection()),
      'GET /api/v1/movements': () => json({ items: [], nextCursor: null }),
      'GET /api/v1/debts': () => json([]),
      'GET /api/v1/preferences': () => json(DEFAULT_PREFERENCES),
      'PUT /api/v1/preferences': (init) => json(JSON.parse(String(init.body))),
    };
    fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
      const key = `${init.method ?? 'GET'} ${new URL(url).pathname}`;
      const route = routes[key];
      if (!route) throw new Error(`unexpected request ${key}`);
      return route(init);
    });
    vi.stubGlobal('fetch', fetchMock);

    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((cb) => {
      authListener = cb as typeof authListener;
      return { data: { subscription: { unsubscribe: vi.fn() } } } as never;
    });
  });
}

export const requests = (method: string, path: string) =>
  fetchMock.mock.calls.filter(([url, init]) => (init?.method ?? 'GET') === method && new URL(url).pathname === path);

/** Renders the app signed in (or not), and waits for the dashboard's net worth (12,345.60 unless told). */
export async function renderApp(session: Session | null = SESSION, netWorth = '$12,346') {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session } } as never);
  const utils = render(
    <AuthProvider>
      <HomePage />
    </AuthProvider>,
  );
  if (session) await screen.findByText(netWorth);
  return utils;
}

export const nav = (label: string) => fireEvent.click(screen.getByRole('button', { name: label }));
