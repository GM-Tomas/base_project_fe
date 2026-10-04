import { describe, expect, it } from 'vitest';
import { ApiError } from './apiError';
import { createMockApi } from './mockApi';

const at = (iso: string) => () => new Date(iso);
const grown = (i: number) => Math.round(88_000 * 1.022 ** i * 100) / 100;

describe('mock API (the data previews run on)', () => {
  it('summarizes the demo portfolio like the API does', async () => {
    const api = createMockApi(at('2026-10-04T10:00:00Z'));

    const summary = await api.getSummary();

    expect(summary.netWorth.usd).toBe(107_420);
    expect(summary.holdingsCount).toBe(7);
    expect(summary.byAssetClass).toEqual([
      { assetClass: 'Index Fund', valueUsd: 42_350, pct: 39.4, count: 1 },
      { assetClass: 'Crypto', valueUsd: 24_570, pct: 22.9, count: 2 },
      { assetClass: 'Fixed Income', valueUsd: 15_000, pct: 14, count: 1 },
      { assetClass: 'Equity', valueUsd: 12_800, pct: 11.9, count: 1 },
      { assetClass: 'Cash', valueUsd: 12_700, pct: 11.8, count: 2 },
    ]);
    expect(summary.byPlatform).toEqual([
      { name: 'Interactive Brokers', type: 'Broker', valueUsd: 55_150, pct: 51.3, count: 2 },
      { name: 'Binance', type: 'Exchange', valueUsd: 24_570, pct: 22.9, count: 2 },
      { name: 'Balanz', type: 'Broker', valueUsd: 15_000, pct: 14, count: 1 },
      { name: 'Santander', type: 'Bank', valueUsd: 9_500, pct: 8.8, count: 1 },
      { name: 'Mercado Pago', type: 'Wallet', valueUsd: 3_200, pct: 3, count: 1 },
    ]);
    expect(summary.liquidity).toEqual({
      liquidPct: 86,
      illiquidPct: 14,
      liquidAssetClasses: ['Cash', 'Equity', 'Crypto', 'Index Fund'],
    });
    // Nine monthly snapshots up to last month: January's is the year's first.
    expect(summary.ytd).toEqual({
      basis: 'YEAR_START_SNAPSHOT',
      growthPct: 22.1,
      baselineValueUsd: 88_000,
      baselineAt: '2026-01-01T12:00:00.000Z',
    });
  });

  it('falls back to the earliest snapshot, then to no baseline', async () => {
    // In January the nine months of history all fall in the previous year.
    const january = createMockApi(at('2026-01-10T10:00:00Z'));
    expect((await january.getSummary()).ytd).toMatchObject({ basis: 'EARLIEST_SNAPSHOT', baselineAt: '2025-04-01T12:00:00.000Z' });

    const empty = createMockApi(at('2026-10-04T10:00:00Z'));
    for (const h of await empty.getHoldings()) await empty.deleteHolding(h.id);
    const summary = await empty.getSummary();
    expect(summary.netWorth.usd).toBe(0);
    expect(summary.liquidity).toMatchObject({ liquidPct: 0, illiquidPct: 0 });
    expect(summary.ytd.basis).toBe('YEAR_START_SNAPSHOT'); // a 0 net worth still compares to January
    expect(summary.byPlatform).toEqual([]);
  });

  it('lists platforms and asset classes like the API', async () => {
    const api = createMockApi(at('2026-10-04T10:00:00Z'));

    expect(await api.getPlatforms()).toEqual([
      { name: 'Balanz', type: 'Broker', createdAt: '2025-05-15T00:00:00.000Z' },
      { name: 'Binance', type: 'Exchange', createdAt: '2025-03-15T00:00:00.000Z' },
      { name: 'Interactive Brokers', type: 'Broker', createdAt: '2025-01-15T00:00:00.000Z' },
      { name: 'Mercado Pago', type: 'Wallet', createdAt: '2025-07-15T00:00:00.000Z' },
      { name: 'Santander', type: 'Bank', createdAt: '2025-06-15T00:00:00.000Z' },
    ]);
    expect(await api.getAssetClasses()).toEqual({
      defaults: ['Cash', 'Fixed Income', 'Index Fund', 'Equity', 'Crypto'],
      inUse: ['Cash', 'Crypto', 'Equity', 'Fixed Income', 'Index Fund'],
      all: ['Cash', 'Fixed Income', 'Index Fund', 'Equity', 'Crypto'],
    });
  });

  it('keeps what the user adds and removes in this tab', async () => {
    const api = createMockApi(at('2026-10-04T10:00:00Z'));

    const added = await api.createHolding({ name: ' Gold bar ', assetClass: 'Gold', platform: 'binance ', valueUsd: 1_000.004 });
    expect(added).toMatchObject({ name: 'Gold bar', assetClass: 'Gold', platform: 'Binance', valueUsd: 1_000 });
    await api.createHolding({ name: 'Lebac', assetClass: 'Fixed Income', platform: 'Nuevo Banco', valueUsd: 50.25 });

    expect((await api.getSummary()).netWorth.usd).toBe(108_470.25);
    expect((await api.getPlatforms()).map((p) => `${p.name}/${p.type}`)).toContain('Nuevo Banco/Other');
    expect((await api.getAssetClasses()).all).toEqual(['Cash', 'Fixed Income', 'Index Fund', 'Equity', 'Crypto', 'Gold']);

    await api.deleteHolding(added.id);
    expect((await api.getHoldings()).map((h) => h.name)).not.toContain('Gold bar');
    await expect(api.deleteHolding(added.id)).rejects.toMatchObject({ status: 404, message: 'Holding not found' });

    // Copies, not the store itself.
    const [first] = await api.getHoldings();
    first.valueUsd = 1;
    expect((await api.getHoldings())[0].valueUsd).toBe(42_350);
  });

  it('validates new holdings like the API', async () => {
    const api = createMockApi();
    const failure = await api.createHolding({ name: ' ', assetClass: '', platform: ' ', valueUsd: 0 }).catch((e) => e);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ status: 400 });
    expect((failure as ApiError).errors?.map((e) => e.field)).toEqual(['name', 'assetClass', 'platform', 'valueUsd']);
    await expect(api.createHolding({ name: 'x', assetClass: 'Cash', platform: 'Bank', valueUsd: Number.NaN })).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it('records snapshots with the change from the previous one', async () => {
    const api = createMockApi(at('2026-10-04T10:00:00Z'));

    const history = await api.getSnapshots();
    expect(history).toHaveLength(9);
    expect(history[0]).toEqual({ id: 'demo-snapshot-1', capturedAt: '2026-01-01T12:00:00.000Z', totalValueUsd: 88_000, changePctFromPrevious: null });
    expect(history[1].changePctFromPrevious).toBe(2.2);

    const taken = await api.createSnapshot();
    expect(taken).toEqual({
      id: 'demo-snapshot-10',
      capturedAt: '2026-10-04T10:00:00.000Z',
      totalValueUsd: 107_420,
      changePctFromPrevious: Math.round(((107_420 - grown(8)) / grown(8)) * 1000) / 10,
    });
    expect(await api.getSnapshots()).toHaveLength(10);
  });

  it('projects like the API: compound monthly, with the two milestones', async () => {
    const api = createMockApi(at('2026-10-04T10:00:00Z'));

    const flat = await api.getEstimate({ contribution: 1_000, yieldPct: 0, years: 5 });
    expect(flat.principalUsd).toBe(107_420);
    expect(flat.series).toHaveLength(6);
    expect(flat.series[5]).toEqual({ year: 5, futureValueUsd: 167_420, totalContributedUsd: 167_420, interestEarnedUsd: 0 });
    expect(flat.milestones).toEqual([
      { amountUsd: 150_000, status: 'REACHABLE', monthsRequired: 43, targetMonth: '2030-05' },
      { amountUsd: 250_000, status: 'OUT_OF_HORIZON', monthsRequired: null, targetMonth: null },
    ]);

    const compound = await api.getEstimate({ contribution: 0, yieldPct: 12, years: 1 });
    expect(compound.series[1].futureValueUsd).toBeCloseTo(107_420 * 1.01 ** 12, 1);

    await api.createHolding({ name: 'Bonus', assetClass: 'Cash', platform: 'Santander', valueUsd: 50_000 });
    expect((await api.getEstimate({ contribution: 0, yieldPct: 0, years: 1 })).milestones[0]).toEqual({
      amountUsd: 150_000,
      status: 'ACHIEVED',
      monthsRequired: 0,
      targetMonth: null,
    });
  });
});
