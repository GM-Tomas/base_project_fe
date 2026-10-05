import { describe, expect, it } from 'vitest';
import { ApiError } from './apiError';
import { createMockApi } from './mockApi';

const at = (iso: string) => () => new Date(iso);
const grown = (i: number) => Math.round(80_000 * 1.022 ** i * 100) / 100;

describe('mock API (the data previews run on)', () => {
  it('summarizes the demo portfolio like the API does', async () => {
    const api = createMockApi(at('2026-10-04T10:00:00Z'));

    const summary = await api.getSummary();

    // What's owned, less what's owed.
    expect(summary.netWorth.usd).toBe(97_770);
    expect(summary.assets.usd).toBe(107_420);
    expect(summary.debts).toEqual({ usd: 9_650, count: 2, monthlyPaymentUsd: 650 });
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
    // Nine monthly snapshots up to last month: January's is the year's first. Shares are of the assets.
    expect(summary.ytd).toEqual({
      basis: 'YEAR_START_SNAPSHOT',
      growthPct: 22.2,
      baselineValueUsd: 80_000,
      baselineAt: '2026-01-01T12:00:00.000Z',
    });
  });

  it('falls back to the earliest snapshot, then to no baseline', async () => {
    // In January the nine months of history all fall in the previous year.
    const january = createMockApi(at('2026-01-10T10:00:00Z'));
    expect((await january.getSummary()).ytd).toMatchObject({ basis: 'EARLIEST_SNAPSHOT', baselineAt: '2025-04-01T12:00:00.000Z' });

    const empty = createMockApi(at('2026-10-04T10:00:00Z'));
    for (const h of await empty.getHoldings()) await empty.deleteHolding(h.id);
    // Only debts left: the net worth is below zero, and still compares to January.
    const owing = await empty.getSummary();
    expect(owing.netWorth.usd).toBe(-9_650);
    expect(owing.ytd).toMatchObject({ basis: 'YEAR_START_SNAPSHOT', growthPct: -112.1 });
    expect(owing.liquidity).toMatchObject({ liquidPct: 0, illiquidPct: 0 });
    expect(owing.byPlatform).toEqual([]);
    for (const d of await empty.getDebts()) await empty.deleteDebt(d.id);
    const summary = await empty.getSummary();
    expect(summary.netWorth.usd).toBe(0);
    expect(summary.ytd.basis).toBe('YEAR_START_SNAPSHOT'); // a 0 net worth still compares to January

    // A baseline at or below zero has nothing to compare to.
    const negative = createMockApi(at('2026-10-04T10:00:00Z'));
    for (const s of await negative.getSnapshots()) await negative.deleteSnapshot(s.id);
    for (const h of await negative.getHoldings()) await negative.deleteHolding(h.id);
    await negative.createSnapshot();
    expect((await negative.getSummary()).ytd).toEqual({ basis: 'NO_BASELINE', growthPct: 0 });
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

    expect((await api.getSummary()).netWorth.usd).toBe(98_820.25);
    expect((await api.getPlatforms()).map((p) => `${p.name}/${p.type}`)).toContain('Nuevo Banco/Other');
    expect((await api.getAssetClasses()).all).toEqual(['Cash', 'Fixed Income', 'Index Fund', 'Equity', 'Crypto', 'Gold']);

    await api.deleteHolding(added.id);
    expect((await api.getHoldings()).map((h) => h.name)).not.toContain('Gold bar');
    await expect(api.deleteHolding(added.id)).rejects.toMatchObject({ status: 404, message: `Holding ${added.id} not found` });

    // Copies, not the store itself.
    const [first] = await api.getHoldings();
    first.valueUsd = 1;
    expect((await api.getHoldings())[0].valueUsd).toBe(42_350);
  });

  it('edits only what is sent, like PATCH /holdings/{id}', async () => {
    let clock = Date.parse('2026-10-04T10:00:00Z');
    const api = createMockApi(() => new Date(clock));
    const [voo] = await api.getHoldings();
    clock += 60_000;

    // Moved to a platform the account spells differently: the existing spelling wins.
    const edited = await api.updateHolding(voo.id, { name: '  VOO  ', platform: 'binance', valueUsd: 50_000.005 });
    expect(edited).toMatchObject({ name: 'VOO', platform: 'Binance', assetClass: 'Index Fund', valueUsd: 50_000.01 });
    expect(edited.updatedAt).toBe('2026-10-04T10:01:00.000Z');
    expect(edited.createdAt).toBe(voo.createdAt);
    expect((await api.getSummary()).netWorth.usd).toBe(105_420.01);

    // Nothing new: nothing written.
    clock += 60_000;
    expect(await api.updateHolding(voo.id, {})).toEqual(edited);
    expect(await api.updateHolding(voo.id, { name: 'VOO', valueUsd: 50_000.01 })).toEqual(edited);

    // The API's messages; null is a missing required field.
    const failure = await api.updateHolding(voo.id, { name: ' ', platform: null, valueUsd: -1 } as never).catch((e) => e);
    expect(failure).toMatchObject({ status: 400, message: 'Name is required; Platform is required; Value must not be negative' });
    await expect(api.updateHolding(voo.id, { valueUsd: null } as never)).rejects.toMatchObject({ message: 'Value is required' });
    await expect(api.updateHolding(voo.id, { valueUsd: 1e16 })).rejects.toMatchObject({ message: 'Value is too large' });
    await expect(api.updateHolding('nope', { name: 'x' })).rejects.toMatchObject({ status: 404, message: 'Holding nope not found' });
  });

  it('deletes snapshots, and never reuses their ids', async () => {
    const api = createMockApi(at('2026-10-04T10:00:00Z'));
    const [first, second] = await api.getSnapshots();

    await api.deleteSnapshot(first.id);
    const history = await api.getSnapshots();
    expect(history).toHaveLength(8);
    expect(history[0]).toMatchObject({ id: second.id, changePctFromPrevious: null });
    await expect(api.deleteSnapshot(first.id)).rejects.toMatchObject({ status: 404, message: `Snapshot ${first.id} not found` });

    const taken = await api.createSnapshot();
    expect(history.map((s) => s.id)).not.toContain(taken.id);
  });

  it("validates new holdings with the API handler's rules and messages", async () => {
    const api = createMockApi();
    const failure = await api.createHolding({ name: ' ', assetClass: '', platform: ' ', valueUsd: -1 }).catch((e) => e);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({
      status: 400,
      message: 'Name is required; Asset class is required; Platform is required; Value must not be negative',
    });
    expect((failure as ApiError).errors?.map((e) => e.field)).toEqual(['name', 'assetClass', 'platform', 'valueUsd']);

    const valid = { name: 'x', assetClass: 'Cash', platform: 'Bank' };
    await expect(api.createHolding({ ...valid, valueUsd: 1e15 + 1 })).rejects.toMatchObject({ status: 400, message: 'Value is too large' });
    await expect(api.createHolding({ ...valid, valueUsd: Number.NaN })).rejects.toMatchObject({ message: 'Value must be a number' });
    await expect(api.createHolding({ ...valid, valueUsd: 0 })).resolves.toMatchObject({ valueUsd: 0 });
    await expect(api.createHolding({ ...valid, valueUsd: 1e15 })).resolves.toMatchObject({ valueUsd: 1e15 });
  });

  it('reads labels and platform names like the API', async () => {
    const api = createMockApi(at('2026-10-04T10:00:00Z'));

    const added = await api.createHolding({ name: ' Gold \t bar ', assetClass: 'Cafe\u0301', platform: 'INTERACTIVE   brokers', valueUsd: 1 });
    expect(added).toMatchObject({ name: 'Gold bar', assetClass: 'Caf\u00e9', platform: 'Interactive Brokers' });

    // A typed name is just a name, whatever Object.prototype has.
    await api.createHolding({ name: 'x', assetClass: 'Cash', platform: '__proto__', valueUsd: 1 });
    await api.createHolding({ name: 'y', assetClass: 'Cash', platform: 'constructor', valueUsd: 1 });
    expect((await api.getPlatforms()).filter((p) => p.type === 'Other').map((p) => p.name)).toEqual(['__proto__', 'constructor']);
    expect((await api.getSummary()).byPlatform.find((p) => p.name === '__proto__')).toMatchObject({ type: 'Other', count: 1 });
  });

  it("keeps to the API's limits: holdings, snapshots, one snapshot a second", async () => {
    let clock = Date.parse('2026-10-04T10:00:00.250Z');
    const api = createMockApi(() => new Date(clock));

    for (let i = (await api.getHoldings()).length; i < 1000; i++) {
      await api.createHolding({ name: `h${i}`, assetClass: 'Cash', platform: 'Santander', valueUsd: 1 });
    }
    await expect(api.createHolding({ name: 'one more', assetClass: 'Cash', platform: 'Santander', valueUsd: 1 })).rejects.toMatchObject({
      status: 409,
      message: 'You can track up to 1000 holdings. Remove one to add another.',
    });

    expect(await api.createSnapshot()).toMatchObject({ capturedAt: '2026-10-04T10:00:00.000Z' });
    clock += 500;
    await expect(api.createSnapshot()).rejects.toMatchObject({ status: 409, message: 'A snapshot already exists for 2026-10-04T10:00:00Z' });
    for (let i = (await api.getSnapshots()).length; i < 5000; i++) {
      clock += 1000;
      await api.createSnapshot();
    }
    clock += 1000;
    await expect(api.createSnapshot()).rejects.toMatchObject({ status: 409, message: "You've reached the limit of 5000 snapshots." });
  });

  it('records snapshots with the change from the previous one', async () => {
    const api = createMockApi(at('2026-10-04T10:00:00Z'));

    const history = await api.getSnapshots();
    expect(history).toHaveLength(9);
    expect(history[0]).toEqual({
      id: 'demo-snapshot-1',
      capturedAt: '2026-01-01T12:00:00.000Z',
      totalValueUsd: 80_000,
      assetsUsd: 92_350,
      debtsUsd: 12_350,
      changePctFromPrevious: null,
    });
    expect(history[1].changePctFromPrevious).toBe(2.2);

    // The net worth, with the assets and debts behind it.
    const taken = await api.createSnapshot();
    expect(taken).toEqual({
      id: 'demo-snapshot-10',
      capturedAt: '2026-10-04T10:00:00.000Z',
      totalValueUsd: 97_770,
      assetsUsd: 107_420,
      debtsUsd: 9_650,
      changePctFromPrevious: Math.round(((97_770 - grown(8)) / grown(8)) * 1000) / 10,
    });
    expect(await api.getSnapshots()).toHaveLength(10);
  });

  it('projects like the API: compound monthly, with the two milestones', async () => {
    const api = createMockApi(at('2026-10-04T10:00:00Z'));

    // The portfolio grows from the assets; the debts are paid off on their own terms.
    const flat = await api.getEstimate({ contribution: 1_000, yieldPct: 0, years: 5 });
    expect(flat.principalUsd).toBe(107_420);
    expect(flat.debtsUsd).toBe(9_650);
    expect(flat.series).toHaveLength(6);
    expect(flat.series[0]).toMatchObject({ futureValueUsd: 107_420, debtBalanceUsd: 9_650, netWorthUsd: 97_770 });
    expect(flat.series[1]).toMatchObject({ futureValueUsd: 119_420, debtBalanceUsd: 5_026.45, netWorthUsd: 114_393.55 });
    expect(flat.series[5]).toEqual({
      year: 5,
      futureValueUsd: 167_420,
      totalContributedUsd: 167_420,
      interestEarnedUsd: 0,
      debtBalanceUsd: 0,
      netWorthUsd: 167_420,
    });
    expect(flat.milestones).toEqual([
      { amountUsd: 150_000, status: 'REACHABLE', monthsRequired: 43, targetMonth: '2030-05' },
      { amountUsd: 250_000, status: 'OUT_OF_HORIZON', monthsRequired: null, targetMonth: null },
    ]);

    const compound = await api.getEstimate({ contribution: 0, yieldPct: 12, years: 1 });
    expect(compound.series[1].futureValueUsd).toBeCloseTo(107_420 * 1.01 ** 12, 1);

    // Milestones are about the net worth: 157,420 owned is 147,770 net, until the debts go down.
    await api.createHolding({ name: 'Bonus', assetClass: 'Cash', platform: 'Santander', valueUsd: 50_000 });
    expect((await api.getEstimate({ contribution: 0, yieldPct: 0, years: 1 })).milestones[0]).toEqual({
      amountUsd: 150_000,
      status: 'REACHABLE',
      monthsRequired: 5,
      targetMonth: '2027-03',
    });
    for (const d of await api.getDebts()) await api.deleteDebt(d.id);
    expect((await api.getEstimate({ contribution: 0, yieldPct: 0, years: 1 })).milestones[0]).toEqual({
      amountUsd: 150_000,
      status: 'ACHIEVED',
      monthsRequired: 0,
      targetMonth: null,
    });
  });
});
