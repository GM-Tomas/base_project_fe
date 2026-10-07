import { describe, expect, it } from 'vitest';
import { ApiError } from './apiError';
import { createMockApi } from './mockApi';
import { platformIdOf } from './customization';

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
      { assetClass: 'Index Fund', valueUsd: 42_350, pct: 39.4, count: 1, color: null, liquid: true },
      { assetClass: 'Crypto', valueUsd: 24_570, pct: 22.9, count: 2, color: null, liquid: true },
      { assetClass: 'Fixed Income', valueUsd: 15_000, pct: 14, count: 1, color: null, liquid: false },
      { assetClass: 'Equity', valueUsd: 12_800, pct: 11.9, count: 1, color: null, liquid: true },
      { assetClass: 'Cash', valueUsd: 12_700, pct: 11.8, count: 2, color: null, liquid: true },
    ]);
    expect(summary.byPlatform).toEqual([
      { name: 'Interactive Brokers', type: 'Broker', valueUsd: 55_150, pct: 51.3, count: 2, avatarText: null, color: null, textColor: null },
      { name: 'Binance', type: 'Exchange', valueUsd: 24_570, pct: 22.9, count: 2, avatarText: null, color: null, textColor: null },
      { name: 'Balanz', type: 'Broker', valueUsd: 15_000, pct: 14, count: 1, avatarText: null, color: null, textColor: null },
      { name: 'Santander', type: 'Bank', valueUsd: 9_500, pct: 8.8, count: 1, avatarText: null, color: null, textColor: null },
      { name: 'Mercado Pago', type: 'Wallet', valueUsd: 3_200, pct: 3, count: 1, avatarText: null, color: null, textColor: null },
    ]);
    expect(summary.liquidity).toEqual({
      liquidPct: 86,
      illiquidPct: 14,
      liquidAssetClasses: ['Cash', 'Index Fund', 'Equity', 'Crypto'],
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

    const platform = (name: string, type: string, created: string, holdingsCount: number, valueUsd: number) => ({
      id: platformIdOf(name), name, type, avatarText: null, color: null, textColor: null, holdingsCount, valueUsd, createdAt: `2025-${created}-15T00:00:00.000Z`,
    });
    expect(await api.getPlatforms()).toEqual([
      platform('Balanz', 'Broker', '05', 1, 15_000),
      platform('Binance', 'Exchange', '03', 2, 24_570),
      platform('Interactive Brokers', 'Broker', '01', 2, 55_150),
      platform('Mercado Pago', 'Wallet', '07', 1, 3_200),
      platform('Santander', 'Bank', '06', 1, 9_500),
    ]);
    const classes = await api.getAssetClasses();
    expect(classes).toMatchObject({
      defaults: ['Cash', 'Fixed Income', 'Index Fund', 'Equity', 'Crypto'],
      inUse: ['Cash', 'Crypto', 'Equity', 'Fixed Income', 'Index Fund'],
      all: ['Cash', 'Fixed Income', 'Index Fund', 'Equity', 'Crypto'],
    });
    expect(classes.classes[4]).toEqual({
      id: 'Q3J5cHRv', name: 'Crypto', color: null, liquid: true, expectedReturnPct: null, isDefault: true, holdingsCount: 2, valueUsd: 24_570,
    });
    expect(classes.classes[1]).toMatchObject({ name: 'Fixed Income', liquid: false, holdingsCount: 1 });
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
      source: 'AUTO',
      note: null,
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
      source: 'AUTO',
      note: null,
    });
    expect(await api.getSnapshots()).toHaveLength(10);
  });

  it('adds checkpoints from the past where they belong, marked as added by hand', async () => {
    const api = createMockApi(at('2026-10-04T10:00:00Z'));

    // A date is noon UTC; the net worth alone is all owned (or, below zero, all owed).
    const december = await api.createSnapshot({ capturedAt: '2025-12-31', totalValueUsd: 78_000, note: '  From my spreadsheet  ' });
    expect(december).toEqual({
      id: 'demo-snapshot-10',
      capturedAt: '2025-12-31T12:00:00.000Z',
      totalValueUsd: 78_000,
      assetsUsd: 78_000,
      debtsUsd: 0,
      changePctFromPrevious: null,
      source: 'MANUAL',
      note: 'From my spreadsheet',
    });
    expect(await api.createSnapshot({ capturedAt: '2025-06-30', totalValueUsd: -2_500 })).toMatchObject({
      totalValueUsd: -2_500,
      assetsUsd: 0,
      debtsUsd: 2_500,
      note: null,
    });
    // With what was owned and owed, to the second; the change from the one before is worked out again.
    const september = await api.createSnapshot({ capturedAt: '2025-09-30T15:30:00.900Z', totalValueUsd: 50_000, assetsUsd: 65_000, debtsUsd: 15_000 });
    expect(september).toMatchObject({ capturedAt: '2025-09-30T15:30:00.000Z', assetsUsd: 65_000, debtsUsd: 15_000, changePctFromPrevious: null });

    const history = await api.getSnapshots();
    expect(history.map((s) => s.id).slice(0, 4)).toEqual(['demo-snapshot-11', 'demo-snapshot-12', 'demo-snapshot-10', 'demo-snapshot-1']);
    expect(history[2].changePctFromPrevious).toBe(56);
    expect(history[3].changePctFromPrevious).toBe(2.6);
    // An empty body takes today's, as none does.
    expect(await api.createSnapshot({} as never)).toMatchObject({ capturedAt: '2026-10-04T10:00:00.000Z', source: 'AUTO', totalValueUsd: 97_770 });
  });

  it("rejects a past checkpoint the API would reject, with its messages", async () => {
    const api = createMockApi(at('2026-10-04T10:00:00Z'));
    const fails = (past: object) => api.createSnapshot(past as never).catch((e) => e);

    expect(await fails({ note: 'Lost' })).toMatchObject({
      status: 400,
      message: 'capturedAt is required with a past snapshot; totalValueUsd is required with a past snapshot',
    });
    expect(await fails({ capturedAt: '2025-02-30', totalValueUsd: 1e16, assetsUsd: -1, debtsUsd: 1e16 })).toMatchObject({
      message:
        'capturedAt must be a date (YYYY-MM-DD) or a date and time (RFC 3339); totalValueUsd must be between -1000000000000000 and 1000000000000000; assetsUsd must be between 0 and 1000000000000000; debtsUsd must be between 0 and 1000000000000000',
    });
    for (const capturedAt of ['2026-10-04T10:00:01Z', '1969-12-31T23:59:59Z']) {
      expect(await fails({ capturedAt, totalValueUsd: 1 })).toMatchObject({ status: 400, message: 'capturedAt must be in the past, from 1970 on' });
    }
    expect(await fails({ capturedAt: '2025-01-01', totalValueUsd: 1, note: 'x'.repeat(201) })).toMatchObject({
      message: 'Note exceeds max length (201 > 200)',
    });
    expect(await fails({ capturedAt: '2025-01-01', totalValueUsd: 1, assetsUsd: 1 })).toMatchObject({
      message: 'assetsUsd and debtsUsd go together: send both or neither',
    });
    expect(await fails({ capturedAt: '2025-01-01', totalValueUsd: 10, assetsUsd: 20, debtsUsd: 5 })).toMatchObject({
      message: 'totalValueUsd must be assetsUsd − debtsUsd',
    });
    // One per second, as today's.
    await api.createSnapshot({ capturedAt: '2025-01-01', totalValueUsd: 1 });
    expect(await fails({ capturedAt: '2025-01-01T12:00:00Z', totalValueUsd: 2 })).toMatchObject({
      status: 409,
      message: 'A snapshot already exists for 2025-01-01T12:00:00Z',
    });
    expect(await api.getSnapshots()).toHaveLength(10);
  });

  it('keeps how the app opens, checked as the API checks it', async () => {
    const api = createMockApi(at('2026-10-04T10:00:00Z'));
    expect(await api.getPreferences()).toMatchObject({ autoSnapshot: 'OFF', defaultView: 'dashboard', historyPeriod: '1Y', language: 'auto' });

    const saved = await api.savePreferences({
      estimate: { years: 20 } as never,
      autoSnapshot: 'MONTHLY',
      defaultView: 'history',
      historyPeriod: '3M',
      language: 'es',
    });
    expect(saved).toMatchObject({
      estimate: { years: 20, contributionUsd: 900 },
      autoSnapshot: 'MONTHLY',
      defaultView: 'history',
      historyPeriod: '3M',
      language: 'es',
    });
    // What a PUT leaves out takes its default.
    expect(await api.savePreferences({ estimate: {} as never } as never)).toMatchObject({ autoSnapshot: 'OFF', defaultView: 'dashboard' });

    await expect(
      api.savePreferences({
        estimate: {} as never,
        autoSnapshot: 'WEEKLY' as never,
        defaultView: 'reports' as never,
        historyPeriod: 'CUSTOM' as never,
        language: 'fr' as never,
      }),
    ).rejects.toMatchObject({
      status: 400,
      message:
        'autoSnapshot must be one of OFF, MONTHLY; defaultView must be one of dashboard, platforms, assets, debts, estimate, history, settings; historyPeriod must be one of 1M, 3M, 6M, YTD, 1Y, 3Y, ALL; language must be one of auto, en, es',
    });
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
      realFutureValueUsd: 167_420,
      realNetWorthUsd: 167_420,
    });
    expect(flat).toMatchObject({ yieldSource: 'CUSTOM', annualYieldPct: 0, portfolioYieldPct: 9.59, inflationPct: 0, contributionGrowthPct: 0 });
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

  it('weighs the demo portfolio\'s expected returns, and projects at them unless told otherwise', async () => {
    const api = createMockApi(at('2026-10-04T10:00:00Z'));

    // (42,350×8 + 12,800×10 + (18,450+6,120)×20 + 15,000×4.5 + 9,500×0.5) / 107,420; the emergency fund has none.
    expect((await api.getSummary()).expectedReturn).toEqual({ weightedPct: 9.59, coveragePct: 97, annualUsd: 10_304.5 });
    const portfolio = await api.getEstimate({ contribution: 0, years: 1, milestones: [] });
    expect(portfolio).toMatchObject({ yieldSource: 'PORTFOLIO', annualYieldPct: 9.59, portfolioYieldPct: 9.59, milestones: [] });
    expect(portfolio.series[1].futureValueUsd).toBeCloseTo(107_420 * (1 + 0.0959 / 12) ** 12, 1);

    // A raise each year, and inflation for today's dollars.
    const adjusted = await api.getEstimate({ contribution: 100, years: 2, yieldPct: 0, contributionGrowthPct: 10, inflationPct: 12 });
    expect(adjusted.series[2].totalContributedUsd).toBe(107_420 + 1_200 + 1_320);
    expect(adjusted.series[1].realFutureValueUsd).toBe(Math.round(((107_420 + 1_200) / 1.01 ** 12) * 100) / 100);
    expect(adjusted.series[2].realNetWorthUsd).toBeLessThan(adjusted.series[2].netWorthUsd);

    // Milestones of one's own, in order.
    const mine = await api.getEstimate({ contribution: 0, years: 1, yieldPct: 0, milestones: [1e6, 50_000] });
    expect(mine.milestones.map((m) => [m.amountUsd, m.status])).toEqual([
      [50_000, 'ACHIEVED'],
      [1e6, 'OUT_OF_HORIZON'],
    ]);

    // The API's checks, all at once.
    const failure = await api
      .getEstimate({ contribution: -1, years: 51, yieldPct: 101, milestones: [1, 2, 3, 4, 5, 6], inflationPct: 51, contributionGrowthPct: -1 })
      .catch((e) => e);
    expect(failure).toMatchObject({
      status: 400,
      message:
        'contribution must be between 0 and 1000000000; yieldPct must be between -100 and 100; years must be between 1 and 50; ' +
        'milestones must be up to 5 comma-separated amounts between 0 and 1000000000000000; inflationPct must be between 0 and 50; ' +
        'contributionGrowthPct must be between 0 and 50',
    });

    // Nothing owned: nothing to weigh, 0%.
    for (const h of await api.getHoldings()) await api.deleteHolding(h.id);
    expect((await api.getSummary()).expectedReturn).toEqual({ weightedPct: null, coveragePct: 0, annualUsd: 0 });
    expect(await api.getEstimate({ contribution: 0, years: 1 })).toMatchObject({ annualYieldPct: 0, portfolioYieldPct: null });
  });

  it("keeps each holding's expected return, set one by one or all at once", async () => {
    let clock = Date.parse('2026-10-04T10:00:00Z');
    const api = createMockApi(() => new Date(clock));
    const [voo, apple] = await api.getHoldings();
    expect(voo).toMatchObject({ expectedReturnPct: 8, effectiveReturnPct: 8 });

    const added = await api.createHolding({ name: 'Gold', assetClass: 'Gold', platform: 'Vault', valueUsd: 100, expectedReturnPct: 3.456 });
    expect(added).toMatchObject({ expectedReturnPct: 3.46, effectiveReturnPct: 3.46 });
    await expect(
      api.createHolding({ name: 'x', assetClass: 'Cash', platform: 'Bank', valueUsd: 1, expectedReturnPct: 100.01 }),
    ).rejects.toMatchObject({ status: 400, message: 'expectedReturnPct must be between -100 and 100' });

    // A new return alone is a change, without a movement; null clears it.
    clock += 60_000;
    const before = (await api.getMovements()).items.length;
    expect(await api.updateHolding(voo.id, { expectedReturnPct: -2.5 })).toMatchObject({
      expectedReturnPct: -2.5,
      updatedAt: '2026-10-04T10:01:00.000Z',
    });
    expect(await api.updateHolding(voo.id, { expectedReturnPct: null })).toMatchObject({ expectedReturnPct: null, effectiveReturnPct: null });
    expect((await api.getMovements()).items).toHaveLength(before);

    // All at once: in the order asked, unchanged ones untouched.
    clock += 60_000;
    const set = await api.setExpectedReturns([
      { holdingId: apple.id, expectedReturnPct: 10 },
      { holdingId: voo.id, expectedReturnPct: 7 },
    ]);
    expect(set.map((h) => [h.name, h.expectedReturnPct, h.updatedAt])).toEqual([
      ['Apple (AAPL)', 10, apple.updatedAt],
      ['Vanguard S&P 500 ETF (VOO)', 7, '2026-10-04T10:02:00.000Z'],
    ]);

    // The handler's checks (every problem at once), then all or none.
    const fails = (items: unknown) => api.setExpectedReturns(items as never).catch((e) => e);
    expect(await fails(undefined)).toMatchObject({ status: 400, message: 'items is required' });
    expect(await fails(Array.from({ length: 1001 }, () => ({ holdingId: 'x', expectedReturnPct: 1 })))).toMatchObject({
      message: "items can't have more than 1000 entries",
    });
    expect(await fails([{ holdingId: ' ', expectedReturnPct: 1 }, { holdingId: voo.id }, { holdingId: voo.id, expectedReturnPct: 101 }])).toMatchObject({
      status: 400,
      message:
        'items[0].holdingId is required; items[1].expectedReturnPct is required (null clears it); ' +
        'items[2].holdingId appears more than once; items[2].expectedReturnPct must be between -100 and 100',
    });
    expect(await fails([{ holdingId: voo.id, expectedReturnPct: 1 }, { holdingId: 'gone', expectedReturnPct: 1 }])).toMatchObject({
      status: 404,
      message: 'Holding gone not found',
    });
    expect((await api.getHoldings())[0]).toMatchObject({ expectedReturnPct: 7 });
  });

  it('keeps the preferences: the defaults, then what is saved, as the API checks them', async () => {
    const api = createMockApi(at('2026-10-04T10:00:00Z'));
    const defaults = await api.getPreferences();
    expect(defaults.estimate).toEqual({
      contributionUsd: 900,
      years: 12,
      yieldMode: 'PORTFOLIO',
      customYieldPct: 9,
      milestonesUsd: [150_000, 250_000],
      inflationPct: 0,
      contributionGrowthPct: 0,
    });
    defaults.estimate.years = 1; // a copy
    expect((await api.getPreferences()).estimate.years).toBe(12);

    // What's left out takes its default; amounts and percentages as the API keeps them.
    const saved = await api.savePreferences({
      estimate: { contributionUsd: 1_500.555, years: 20, yieldMode: 'CUSTOM', customYieldPct: 6.256, milestonesUsd: [5e5, 1e5] },
    } as never);
    expect(saved.estimate).toEqual({
      contributionUsd: 1_500.56,
      years: 20,
      yieldMode: 'CUSTOM',
      customYieldPct: 6.26,
      milestonesUsd: [1e5, 5e5],
      inflationPct: 0,
      contributionGrowthPct: 0,
    });
    expect(await api.getPreferences()).toEqual(saved);

    const failure = await api
      .savePreferences({
        estimate: { contributionUsd: -1, years: 51, yieldMode: 'MAGIC', customYieldPct: 101, milestonesUsd: [1, 2, 3, 4, 5, -6], inflationPct: 51, contributionGrowthPct: -1 },
      } as never)
      .catch((e) => e);
    expect(failure).toMatchObject({
      status: 400,
      message:
        'contributionUsd must be between 0 and 1000000000; years must be between 1 and 50; yieldMode must be one of PORTFOLIO, CUSTOM; ' +
        'customYieldPct must be between -100 and 100; at most 5 milestones; milestones must be amounts between 0 and 1000000000000000; ' +
        'inflationPct must be between 0 and 50; contributionGrowthPct must be between 0 and 50',
    });
    expect(failure.errors[0].field).toBe('estimate.contributionUsd');
    await expect(api.savePreferences({ estimate: { years: 1.5 } } as never)).rejects.toMatchObject({ message: 'Malformed JSON body' });
    expect(await api.getPreferences()).toEqual(saved);
  });
});
